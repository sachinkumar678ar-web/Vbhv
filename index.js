const { Telegraf } = require("telegraf")
const axios = require("axios")
const express = require("express")

// ---------------- CONFIG ----------------

const BOT_TOKEN = "8620104431:AAH7De-hiD_D6ZVWIDcTcExh1MDDeeWUMDg"
const HISTORY_CHANNEL = "-1003844111093"
const PREDICTION_CHANNEL = "-1003844111093"

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

// ---------------- RULE ENGINE (Based on Last Digit of Period) ----------------

function ruleEngine(periodNumber){
    // Period ka last character nikalna
    const lastDigit = parseInt(periodNumber.toString().slice(-1));
    
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
    
    return rules[lastDigit];
}

// ---------------- RESULT CHECK ----------------

async function checkResult(number){
    if(!lastPrediction) return;

    let resultStatus = ""
    let sticker = ""

    // Purana Prediction Message Delete Karna
    if(lastMsgId){
        try {
            await bot.telegram.deleteMessage(PREDICTION_CHANNEL, lastMsgId)
        } catch(e) {}
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

async function sendPrediction(issue){
    // Rule Engine ko current Period Number dena
    const rule = ruleEngine(issue);
    const nextIssue = (BigInt(issue) + 1n).toString();

    lastPrediction = rule.result;
    suggestedNumbers = rule.nums;
    lastChance = rule.chance;

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
        const proxy = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(API_URL)}`
        const res = await axios.get(proxy)
        const data = res.data.data.list[0]

        const issue = data.issueNumber;
        const number = parseInt(data.number);

        if(issue === lastIssue) return;

        // Result check (Pichle Period ka)
        if(lastIssue !== ""){
            await checkResult(number)
        }

        lastIssue = issue;

        // History Channel Update
        await bot.telegram.sendMessage(HISTORY_CHANNEL, `📜 WIN GO HISTORY
━━━━━━━━━━━━━━
PERIOD : ${issue}
NUMBER : ${number}
RESULT : ${number>=5?"BIG":"SMALL"}
━━━━━━━━━━━━━━`)

        // Next Prediction (Current Issue se agle ke liye predict karna)
        await sendPrediction(issue)

    } catch(e) {
        console.log("SCAN ERROR")
    }
}

// ---------------- SERVER & START ----------------

const app = express()
app.get("/", (req,res) => res.send("Bot Active"))
app.listen(process.env.PORT || 3000)

bot.launch()
setInterval(scan, 12000) // Har 12 second me check karega

console.log("Bot logic updated to Period's Last Digit Rule!")
