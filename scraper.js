const chromium = require('chrome-aws-lambda'); // main library for web scraping in aws cloud environment
//const puppeteer = require('puppeteer'); // main library for web scrapping, use chrome-aws-lambda for aws environment instead
const C = require('./constants'); //contains all the environmental variables

//CSS SELECTOR for username, password textbox and login button on targeted website
const USERNAME_SELECTOR = '#user_login';
const PASSWORD_SELECTOR = '#pwd';
const CTA_SELECTOR = '#wp-submit';
let message = '';


async function startBrowser() {
    // const browser = await chromium.puppeteer.launch({ slowMo: 30 , args: ['--no-sandbox'] }); //slowmo 30ms to ensure credentials are entered in a timely manner
    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
        slowMo: 30 //slowmo 30ms to ensure credentials are entered in a timely manner
    });
    const page = await browser.newPage();
    return { browser, page };
}

async function closeBrowser(browser) {
    return browser.close();
}

// core function to scrap CAT 1 details
async function scrapWeb(url) {
    const { browser, page } = await startBrowser();
    page.setViewport({ width: 1366, height: 1020 });

    // perform series of automation for login
    await page.goto(url);
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(C.username);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(C.password);
    await page.click(CTA_SELECTOR);



    // snap a screenshot of the CAT 1 overview
    //await page.screenshot({ path: 'weather.png' });


    // go to CAT 1 related URL upon logging in successfully
    // networkidle0: consider navigation to be finished when there are no more than 0 network connections for at least 500 ms. Solves reading cells of undefined
    await page.goto(C.scrap_url, { waitUntil: 'networkidle0' });


    // Get the cat 1 table results
    let [sector, CAT, validity] = await page.evaluate(() => {

        var nodes = document.querySelectorAll('tr');
        // nodes as of now, first sector is index [4], last sector is index [35]
        var list = [];
        var i;
        // add all sectors into list, from index 4 aka first sector to index 35 aka last sector
        for (i = 4; i <= 35; i++) {
            list.push(nodes[i]);
        }
        //if website loads too slow, might get cells of undefined error
        if (list.length == 32) { //total 32 sectors, only if list is exact 32 items
            return [
                list.map(s => s.cells[0].innerHTML), // sector
                list.map(s => s.cells[1].innerHTML), // CAT status
                list.map(s => s.cells[2].innerHTML)  // validity
            ];
        }


    });
    if (!sector || !CAT || !validity) {
        // sector or CAT or validity is undefined
        console.log("Not working");
    }
    else {
        // console.log(sector);
        // console.log(CAT);
        // console.log(validity);

        // CAT = [
        //     '1', '0', '1', '0', '0', '1',
        //     '0', '0', '0', '0', '0', '0',
        //     '0', '0', '0', '0', '0', '0',
        //     '0', '0', '0', '0', '0', '0',
        //     '0', '0', '0', '0', '0', '0',
        //     '1', '1'
        // ];

        // validity = [
        //     '1620-1820', '1600-1800', '1620-1820',
        //     '1600-1800', '1600-1800', '1620-1820',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1600-1800', '1600-1800', '1600-1800',
        //     '1630-1830', '1630-1830'
        // ];

        // display all sector clear if all sector's CAT status is 0
        if (!CAT.includes('1')) {
            message = '⚡[CAT Status Update]⚡\n';
            message += `All Sectors Clear: ${validity[0]}`;
        }
        else // show which sector is CAT 1
        {
            var CAT1List = [];

            // add only CAT 1 sectors to new list
            for (var i = 0; i < CAT.length; i++) {
                if (CAT[i] == 1) {
                    CAT1List.push({
                        sector: sector[i],
                        validity: validity[i]
                    });
                }
            }

            // add all the validity timing into a list
            var validityList = [];
            for (var i = 0; i < CAT1List.length; i++) {
                validityList.push(CAT1List[i].validity);
            }

            // using sets to find out unique validity timing
            const uniqueValidityList = validityList => {
                return [...new Set(validityList)];
            };
            message = '⚡[CAT Status Update]⚡\n';
            message += 'CAT 1:';
            var i;
            // loop through unique validity timing and display a group of sectors under same validity timing
            for (i = 0; i < uniqueValidityList(validityList).length; i++) {
                if (i == 0) {
                    message += '\n[' + uniqueValidityList(validityList)[i] + ']\n';
                    message += 'Sector: ';
                }
                else if (i <= uniqueValidityList(validityList).length - 1) { //if loop reaches last validity group, put new line in front to indicate new group of validity
                    message += '\n\n[' + uniqueValidityList(validityList)[i] + ']\n';
                    message += 'Sector: ';
                }

                for (var j = 0; j < CAT1List.length; j++) { 
                    if (CAT1List[j].validity == uniqueValidityList(validityList)[i]) { //if cat 1 validity records equals to the unique validity, show cat 1 info respectively
                        if(j == CAT1List.length - 1){ //if loop reaches last record, don't show comma
                            message += CAT1List[j].sector;
                        }
                        else {
                            message += CAT1List[j].sector + ', ';
                        }
                    }
                }

            }
        }
    }

    // ends the scrapping session
    await closeBrowser(browser);
    return message


    //await browser.waitForTarget(()=> false);
}


exports.scrapWeb = scrapWeb;
