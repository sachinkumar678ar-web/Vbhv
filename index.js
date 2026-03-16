const { Telegraf } = require("telegraf")
const axios = require("axios")
const express = require("express")

// ---------------- CONFIG ----------------

const BOT_TOKEN = "8795656071:AAHc06vrNqP1iKigR7yYnTTMArMRC4S6ykQ"

const HISTORY_CHANNEL = "-1003756626165"
const PREDICTION_CHANNEL = "-1003829129679"

const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageSize=1"

// STICKERS

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

async function checkResult(number){

let result=""
let sticker=""

if(suggestedNumbers.includes(number)){
result="🤩 JACKPOT"
sticker=JACKPOT_STICKER
}

else if(
(lastPrediction=="BIG" && number>=5) ||
(lastPrediction=="SMALL" && number<=4)
){
result="✅ WIN"
sticker=WIN_STICKER
}

else{
result="❌ LOSS"
sticker=LOSS_STICKER
}

// prediction delete

if(lastMsgId){
await bot.telegram.deleteMessage(PREDICTION_CHANNEL,lastMsgId).catch(()=>{})
}

await bot.telegram.sendMessage(PREDICTION_CHANNEL,`
🎯 RESULT
━━━━━━━━━━━━━━

🤩CHANCE🤩 : ${lastChance}

🏁BET NUMBER 🏁: ${suggestedNumbers.join(" , ")}

✅NUMBER✅ : ${number}

━━━━━━━━━━━━━━
          ${result}
`)

await bot.telegram.sendSticker(PREDICTION_CHANNEL,sticker)

}

// ---------------- PREDICTION ----------------

async function sendPrediction(lastNumber,issue){

const rule = ruleEngine(lastNumber)

lastPrediction = rule.result
suggestedNumbers = rule.nums
lastChance = rule.chance

const msg = `
🎯 AI PREDICTION
━━━━━━━━━━━━━━

🌺PERIOD🌺 : ${issue}

🌺RESULT🌺 : ${rule.result}

🤩CHANCE🤩 : ${rule.chance}

🏁BET NUMBER 🏁: ${rule.nums.join(" , ")}
`

const message = await bot.telegram.sendMessage(PREDICTION_CHANNEL,msg)

lastMsgId = message.message_id

}

// ---------------- API SCAN ----------------

async function scan(){

try{

const proxy = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(API_URL)}`

const res = await axios.get(proxy,{timeout:10000})

const data = res.data.data.list[0]

const issue = data.issue
const number = parseInt(data.number)

if(issue==lastIssue) return

// check result

if(lastIssue!=""){
await checkResult(number)
}

lastIssue = issue

// send history

await bot.telegram.sendMessage(HISTORY_CHANNEL,`
📜 WIN GO HISTORY
━━━━━━━━━━━━━━

🌺PERIOD🌺 : ${issue}

🎯NUMBER🎯 : ${number}

RESULT : ${number>=5?"BIG":"SMALL"}

━━━━━━━━━━━━━━
`)

// next prediction

await sendPrediction(number,issue)

}catch(e){

console.log("API ERROR")

}

}

// ---------------- COMMANDS ----------------

bot.start((ctx)=>{

ctx.reply(`
🤖 AI Prediction Bot Running

Commands

/history
`)

})

bot.command("history",(ctx)=>{

ctx.reply("History automatic API se aa raha hai")

})

// ---------------- SERVER ----------------

const app = express()

app.get("/",(req,res)=>{
res.send("Bot Running 24 Hours 🚀")
})

app.listen(3000)

// ---------------- START ----------------

bot.launch()

console.log("Bot Started")

setInterval(scan,15000)
