const puppeteer = require("puppeteer-core");

(async () => {
    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        headless: false
    });
    
    
    
    const page = await browser.newPage();

    await page.setViewport({
        width: 3840,
        height: 2160,
        deviceScaleFactor: 4
    });

    
    
    await page.goto("file://" + __dirname + "/index.html", {
        waitUntil: "networkidle0"
    });
    
    
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    await page.screenshot({
        path: "output.png",
        fullPage: true
    });

    await browser.close();
})();