const { Telegraf } = require("telegraf")
const axios = require("axios")
const express = require("express")

// ---------------- CONFIG ----------------

const BOT_TOKEN = "8620104431:AAH7De-hiD_D6ZVWIDcTcExh1MDDeeWUMDg"
const HISTORY_CHANNEL = "-1003844111093"
const PREDICTION_CHANNEL = "-1003268498087"

const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=1"

const WIN_STICKER = "CAACAgUAAxkBAAFE9FtpuAQsz_OSJEL23Mxjo-Ox-VJD9AACnRUAAjCBqVTN3Vho3FjTQjoE"
const LOSS_STICKER = "CAACAgIAAxkBAAFE9GtpuAS8nPYwxKSN3ixuq4a3PKyOCgACNAADWbv8JWBOiTxAs-8HOgQ"
const JACKPOT_STICKER = "CAACAgUAAxkBAAFE9GFpuASaSlQC_acxHog5Xh5PcEMivQACkRIAApIlqVQtesPFGBnFNToE"

const bot = new Telegraf(BOT_TOKEN)

let lastIssue = ""
let lastPrediction = ""
let suggestedNumbers = []
let lastMsgId = null
let lastChance = ""

// ---------------- RULE ENGINE ----------------

function ruleEngine(lastNumber){
    const rules = {
        0:{result:"SMALL",chance:"85%",nums:[4,2]},
        1:{result:"BIG",chance:"70%",nums:[6,8]},
        2:{result:"SMALL",chance:"75%",nums:[1,3]},
        3:{result:"BIG",chance:"65%",nums:[9,7]},
        4:{result:"SMALL",chance:"80%",nums:[0,2]},
        5:{result:"SMALL",chance:"90%",nums:[3,1]},
        6:{result:"BIG",chance:"70%",nums:[5,7]},
        7:{result:"SMALL",chance:"75%",nums:[0,4]},
        8:{result:"BIG",chance:"65%",nums:[9,5]},
        9:{result:"SMALL",chance:"85%",nums:[1,3]}
    }
    return rules[lastNumber]
}

// ---------------- RESULT CHECK ----------------

async function checkResult(number, issue){
    let resultStatus = ""
    let sticker = ""

    // Prediction message delete karna
    if(lastMsgId){
        try {
            await bot.telegram.deleteMessage(PREDICTION_CHANNEL, lastMsgId)
        } catch(e) { console.log("Delete Error") }
    }

    if(suggestedNumbers.includes(number)){
        resultStatus = "🤩 JACKPOT"
        sticker = JACKPOT_STICKER
    }
    else if((lastPrediction=="BIG" && number>=5) || (lastPrediction=="SMALL" && number<=4)){
        resultStatus = "✅ WIN"
        sticker = WIN_STICKER
    }
    else {
        resultStatus = "❌ LOSS"
        sticker = LOSS_STICKER
    }

    const resMsg = `🎯 RESULT
━━━━━━━━━━━━━━
🤩CHANCE🤩 : ${lastChance}

🏁BET NUMBER 🏁: ${suggestedNumbers.join(" , ")}
✅NUMBER✅ : ${number}
━━━━━━━━━━━━━━
${resultStatus}`

    await bot.telegram.sendMessage(PREDICTION_CHANNEL, resMsg)
    await bot.telegram.sendSticker(PREDICTION_CHANNEL, sticker)
}

// ---------------- PREDICTION SEND ----------------

async function sendPrediction(lastNumber, issue){
    const rule = ruleEngine(lastNumber)
    const nextIssue = (BigInt(issue) + 1n).toString() // Agla Period calculate karna

    lastPrediction = rule.result
    suggestedNumbers = rule.nums
    lastChance = rule.chance

    const msg = `🎯 AI PREDICTION
━━━━━━━━━━━━━━

🌺PERIOD🌺 : ${nextIssue}

🌺RESULT🌺 : ${rule.result}

🤩CHANCE🤩 : ${rule.chance}

🏁BET NUMBER 🏁: ${rule.nums.join(" , ")}`

    const message = await bot.telegram.sendMessage(PREDICTION_CHANNEL, msg)
    lastMsgId = message.message_id
}

// ---------------- API SCAN ----------------

async function scan(){
    try {
        // Proxy URL fixed with backticks
        const proxy = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(API_URL)}`
        const res = await axios.get(proxy)
        
        const data = res.data.data.list[0]
        const issue = data.issueNumber
        const number = parseInt(data.number)

        if(issue === lastIssue) return

        // Agar pichla prediction tha, toh result check karo
        if(lastIssue !== ""){
            await checkResult(number, issue)
        }

        lastIssue = issue

        // HISTORY SEND
        await bot.telegram.sendMessage(HISTORY_CHANNEL, `📜 WIN GO HISTORY
━━━━━━━━━━━━━━
PERIOD : ${issue}
NUMBER : ${number}
RESULT : ${number>=5?"BIG":"SMALL"}
━━━━━━━━━━━━━━`)

        // NEXT PREDICTION
        await sendPrediction(number, issue)

    } catch(e) {
        console.log("API ERROR: Server might be down or Proxy issues")
    }
}

// ---------------- COMMANDS & SERVER ----------------

bot.start((ctx)=> ctx.reply("🤖 AI Prediction Bot Running"))

const app = express()
app.get("/", (req,res) => res.send("Bot Running 24 Hours 🚀"))
app.listen(process.env.PORT || 3000)

bot.launch()
setInterval(scan, 15000) // 15 Seconds interval is safer

console.log("Bot Started...")
