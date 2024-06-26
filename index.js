const axios = require('axios');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

function displayAsciiArt() {
    console.log();
    console.log("    /\\_____/\\  ");
    console.log("   /  o   o  \\    Airdrop");
    console.log("  ( ==  ^  == )      SuperMeow");
    console.log("   )         ( ");
    console.log();
}

function readHashFile() {
    const filePath = path.join(__dirname, 'hash.txt');
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');

    const accounts = lines.map(line => {
        const parsedData = querystring.parse(line);
        let auth_data;

        try {
            auth_data = JSON.parse(decodeURIComponent(parsedData.auth_data));
        } catch (error) {
            console.error("Error parsing JSON:", error);
            return null;
        }

        return {
            id: parsedData.telegram,
            is_on_chain: parsedData.is_on_chain === 'true',
            auth_data: auth_data,
            account: null
        };
    }).filter(account => account !== null);

    return accounts;
}

function getCurrentDateTime() {
    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID');
    const tanggal = now.toLocaleDateString('id-ID');
    return `[${jam}, ${tanggal}]`;
}

async function claimReferralCommission(account) {
    try {
        const { auth_data } = account;

        const claimReffResponse = await axios.post(
            `https://api.supermeow.vip/meow/claim-referral-commission?${querystring.stringify({
                auth_data: JSON.stringify(auth_data)
            })}`,
            null,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return claimReffResponse.data;
    } catch (error) {
        console.error(`${getCurrentDateTime()} \x1b[31mKlaim Referral Commission gagal:\x1b[0m`, error.response ? error.response.status : error.message);
        return false;
    }
}

async function claim(account, index, totalAccounts) {
    try {
        const { id, auth_data, is_on_chain } = account;
        const accountInfo = await getAccountInfo(account);
        account.account = accountInfo;

        console.log(`\n\x1b[33m( ${index}/${totalAccounts} ) ${id}\x1b[0m`);
        console.log(`${getCurrentDateTime()} Username: \x1b[33m${accountInfo.account.username}\x1b[0m`);
        console.log(`${getCurrentDateTime()} Address: \x1b[33m${accountInfo.address}\x1b[0m`);
        console.log(`${getCurrentDateTime()} Token AVAX: \x1b[33m${await getBalance(account)}\x1b[0m`);
        console.log(`${getCurrentDateTime()} On Chain True / False ?`);
        console.log(`${getCurrentDateTime()} ${is_on_chain}`);

        let claimUrl = `https://api.supermeow.vip/meow/claim?${querystring.stringify({
            telegram: id,
            auth_data: JSON.stringify(auth_data)
        })}`;

        if (is_on_chain) {
            claimUrl += '&is_on_chain=true';
        }

        const claimResponse = await axios.post(
            claimUrl,
            null,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const claimData = claimResponse.data;
        processClaimData(claimData, is_on_chain);

        if (is_on_chain) {
            console.log(`${getCurrentDateTime()} Mencoba Klaim Referral Commission`);
            const claimReffSuccess = await claimReferralCommission(account);

            if (claimReffSuccess) {
                console.log(`${getCurrentDateTime()} \x1b[32mKlaim Reff Sukses\x1b[0m`);
            }
        }

        await dailyCheckin(account);
    } catch (error) {
        if (account.is_on_chain) {
            console.error(`${getCurrentDateTime()} \x1b[31mKlaim dengan On Chain True gagal:\x1b[0m`, error.response ? error.response.status : error.message);
            console.log(`${getCurrentDateTime()} Mencoba klaim biasa...`);
            await claimRegular(account, index, totalAccounts);
        } else {
            console.error(`${getCurrentDateTime()} \x1b[31mKlaim gagal:\x1b[0m`, error.response ? error.response.status : error.message);
            console.log();
        }
    }
}

async function claimRegular(account, index, totalAccounts) {
    try {
        const { id, auth_data } = account;

        const claimResponse = await axios.post(
            `https://api.supermeow.vip/meow/claim?${querystring.stringify({
                telegram: id,
                auth_data: JSON.stringify(auth_data)
            })}`,
            null,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const claimData = claimResponse.data;
        processClaimData(claimData, false);

        await dailyCheckin(account);
    } catch (error) {
        console.error(`${getCurrentDateTime()} \x1b[31mKlaim gagal:\x1b[0m`, error.response ? error.response.status : error.message);
        console.log();
    }
}

function processClaimData(claimData, is_on_chain) {
    const lastClaimTime = new Date(claimData.last_claim * 1000);
    const nextClaimTime = new Date((claimData.last_claim + claimData.max_time) * 1000);

    console.log(`${getCurrentDateTime()} ${is_on_chain ? '\x1b[32mKlaim + Bonus' : '\x1b[32mKlaim'} Sukses\x1b[0m`);
    console.log(`${getCurrentDateTime()} Klaim Terakhir: \x1b[33m${lastClaimTime.toLocaleString()}\x1b[0m`);
    console.log(`${getCurrentDateTime()} Klaim Nanti: \x1b[33m${nextClaimTime.toLocaleString()}\x1b[0m`);
    console.log(`${getCurrentDateTime()} Kecepatan Mining: \x1b[33m${claimData.mining_speed}\x1b[0m`);
}

async function dailyCheckin(account) {
    try {
        const { auth_data, account: accountInfo } = account;
        const checkinResponse = await axios.post(
            `https://api.supermeow.vip/meow/serial-checkin?auth_data=${encodeURIComponent(JSON.stringify(auth_data))}`
        );
        const checkinData = checkinResponse.data;
        const lastClaimDaily = new Date(accountInfo.account.last_serial_checkin);


        if (checkinData.is_done) {
            const accountInfo = await getAccountInfo(account);
            console.log(`${getCurrentDateTime()} Daily Login: \x1b[32mDay ${accountInfo.account.level_serial_checkin} Sukses\x1b[0m`);
            console.log(`${getCurrentDateTime()} Total Balance \x1b[33m${accountInfo.account.balance}\x1b[0m`);
        } else {
            console.log(`${getCurrentDateTime()} Daily Login: \x1b[31mKlaim nanti ${lastClaimDaily.toLocaleString()}\x1b[0m`);
            console.log(`${getCurrentDateTime()} Total Balance \x1b[33m${accountInfo.account.balance}\x1b[0m`);
        }
    } catch (error) {
        console.error(`${getCurrentDateTime()} \x1b[31mError during daily checkin:\x1b[0m`, error.response ? error.response.status : error.message);
    }
}

async function getBalance(account) {
    try {
        const { auth_data, id } = account;
        const balanceResponse = await axios.get(
            `https://api.supermeow.vip/meow/balances?telegram=${id}&auth_data=${encodeURIComponent(JSON.stringify(auth_data))}`
        );
        const balanceData = balanceResponse.data;
        const avaxBalance = balanceData.find(token => token.token === 'AVAX');
        return avaxBalance ? avaxBalance.balance : 0;
    } catch (error) {
        console.error(`${getCurrentDateTime()} \x1b[31mError getting balance:\x1b[0m`, error.response ? error.response.status : error.message);
        return 0;
    }
}

async function getAccountInfo(account) {
    try {
        const { auth_data, id } = account;
        const infoResponse = await axios.post(
            `https://api.supermeow.vip/meow/info?telegram=${id}&auth_data=${encodeURIComponent(JSON.stringify(auth_data))}`,
            { user: {} }
        );
        return infoResponse.data;
    } catch (error) {
        console.error(`${getCurrentDateTime()} \x1b[31mError getting account info:\x1b[0m`, error.response ? error.response.status : error.message);
        return null;
    }
}

async function startBot() {
    const accounts = readHashFile();
    displayAsciiArt();
    console.log(`\nTotal akun: ${accounts.length}`);
    console.log();

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        await delay(3000);
        await claim(account, i + 1, accounts.length);
    }

    console.log('\nDelay 1 Jam 1 menit\n');
    await delay(3660000);
    startBot();
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

startBot();