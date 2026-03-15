const { Telegraf } = require("telegraf");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");

puppeteer.use(StealthPlugin());

// ===== CONFIG =====
const BOT_TOKEN = "8620514124:AAEk_ESHTDIrSMXvPchG6x0wvwkdXJa4_Y4";
const MAIN_CHANNEL = "-1003766290985";
const USER_PHONE = "8757430991"; // Apna mobile number yahan dalein
const USER_PASS = "sachin1234";     // Apna password yahan dalein

const bot = new Telegraf(BOT_TOKEN);
let lastIssue = "";
let currentWallet = 0;
let multiplier = 1;
let lastPrediction = "SKIP";

// ===== AI ENGINE (From Game Screen History) =====
function getSmartPrediction(historyData) {
    if (historyData.length < 10) return { skip: true };

    let numbers = historyData.map(x => x.number);
    let latest10 = numbers.slice(0, 10);
    let matchNumbers = [];
    let matchType = "NONE";

    // Match 2 Pattern
    for (let i = 0; i < numbers.length - 2; i++) {
        if (numbers[i + 1] === latest10[0] && numbers[i + 2] === latest10[1]) {
            matchNumbers.push(numbers[i]);
        }
    }

    // Match 1 (Agar Match 2 nahi mila)
    if (matchNumbers.length === 0) {
        for (let i = 0; i < numbers.length - 1; i++) {
            if (numbers[i + 1] === latest10[0]) matchNumbers.push(numbers[i]);
        }
        matchType = "MATCH 1";
    } else {
        matchType = "MATCH 2";
    }

    if (matchNumbers.length === 0) return { skip: true };

    let big = matchNumbers.filter(n => n >= 5).length;
    let small = matchNumbers.length - big;
    return { 
        skip: false, 
        prediction: big >= small ? "BIG" : "SMALL", 
        matchType 
    };
}

// ===== MAIN AUTOMATION FUNCTION =====
async function startAutomation() {
    const browser = await puppeteer.launch({
        headless: false, // Insaani touch dikhane ke liye browser dikhna chahiye
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Browser setup to look like mobile
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36');

    try {
        // 1. LOGIN
        await page.goto('https://51game2.com/#/login', { waitUntil: 'networkidle2' });
        await page.type('input[placeholder*="Phone"]', USER_PHONE, { delay: 150 });
        await page.type('input[type="password"]', USER_PASS, { delay: 150 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        // 2. GO TO WINGO
        await page.goto('https://51game2.com/#/home/AllLotteryGames/WinGo?id=1', { waitUntil: 'networkidle2' });

        setInterval(async () => {
            try {
                // WALLET UPDATE
                const walletElement = await page.$('.wallet-user__balance'); // Selector verify karna hoga
                if (walletElement) {
                    const balanceText = await page.evaluate(el => el.innerText, walletElement);
                    currentWallet = parseFloat(balanceText.replace(/[^\d.]/g, ''));
                }

                // FETCH 500 HISTORY FROM SCREEN
                // Bot yahan page ke 'History' tab par click karega aur data read karega
                const historyData = await page.evaluate(() => {
                    const rows = document.querySelectorAll('.game-history__row'); // Real selector needed
                    return Array.from(rows).slice(0, 500).map(row => {
                        return {
                            issue: row.querySelector('.issue').innerText,
                            number: parseInt(row.querySelector('.number').innerText)
                        };
                    });
                });

                if (historyData.length === 0 || historyData[0].issue === lastIssue) return;

                const latest = historyData[0];
                const resultBS = latest.number >= 5 ? "BIG" : "SMALL";

                // WIN/LOSS REPORTING
                if (lastPrediction !== "SKIP") {
                    let win = (lastPrediction === resultBS);
                    if (win) multiplier = 1;
                    else if (currentWallet >= 100) multiplier *= 2;

                    await bot.telegram.sendMessage(MAIN_CHANNEL, `📊 RESULT: ${latest.issue}\nNumber: ${latest.number} (${resultBS})\nStatus: ${win ? "🏆 WIN" : "❌ LOSS"}`);
                }

                lastIssue = latest.issue;

                // PREDICTION & BETTING
                const ai = getSmartPrediction(historyData);
                const nextIssue = (BigInt(latest.issue) + 1n).toString();
                
                let msg = `🔮 PERIOD: ${nextIssue}\nBalance: ₹${currentWallet}\n`;

                if (ai.skip) {
                    lastPrediction = "SKIP";
                    msg += `⚠️ STATUS: SKIP (No Match)\n📝 ACTION: Bot is waiting...`;
                } else {
                    lastPrediction = ai.prediction;
                    
                    // BET AMOUNT CALCULATION
                    let betAmount = 0;
                    if (currentWallet < 100) {
                        betAmount = Math.floor(currentWallet / 10);
                        if (betAmount < 1) betAmount = 1;
                    } else {
                        betAmount = Math.floor(currentWallet * 0.01) * multiplier;
                    }

                    msg += `🎯 PRED: ${ai.prediction}\n💵 BET: ₹${betAmount}\n🔍 TYPE: ${ai.matchType}`;

                    // --- AUTO CLICK LOGIC ---
                    // Bot 20th second par wait karega
                    let now = new Date();
                    if (now.getSeconds() <= 20) {
                        const targetButton = ai.prediction === "BIG" ? ".big-btn" : ".small-btn"; // Real selector
                        await page.click(targetButton);
                        await page.waitForTimeout(500);
                        await page.type('.bet-input', betAmount.toString());
                        await page.click('.confirm-btn');
                        console.log(`Bet Placed: ${ai.prediction} for ₹${betAmount}`);
                    }
                }

                await bot.telegram.sendMessage(MAIN_CHANNEL, msg);

            } catch (err) {
                console.log("Loop Inner Error:", err.message);
            }
        }, 15000); // Har 15 second me screen check karega

    } catch (e) {
        console.log("Launch Error:", e.message);
    }
}

// ===== COMMANDS =====
bot.command('status', (ctx) => {
    ctx.reply(`🤖 Bot Running\nWallet: ₹${currentWallet}\nLast Pred: ${lastPrediction}`);
});

bot.launch();
startAutomation();
