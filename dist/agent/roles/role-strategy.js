"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleStrategy = void 0;
const login_page_1 = require("../../pages/login.page");
class RoleStrategy {
    constructor(credentials) {
        this.credentials = credentials;
    }
    /**
     * Authenticate role using existing LoginPage POM and TOTP helper
     */
    async login(page) {
        try {
            console.log(`🔑 [Login] Authenticating as ${this.credentials.displayName} (${this.credentials.username})...`);
            const loginPage = new login_page_1.LoginPage(page);
            await loginPage.navigate();
            await loginPage.login(this.credentials.username, this.credentials.password, this.credentials.totpSecret);
            await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
            console.log(`✅ [Login] Successfully authenticated as ${this.credentials.displayName}`);
            return true;
        }
        catch (err) {
            console.error(`❌ [Login] Authentication failed for ${this.credentials.displayName}:`, err.message?.split('\n')[0]);
            return false;
        }
    }
    /**
     * Run standard crawl + role-specific exploration
     */
    async explore(page, crawler, fuzzer, detector, enableA11y = true, enableFuzzing = true) {
        const startTime = Date.now();
        detector.startMonitoring();
        const loggedIn = await this.login(page);
        if (!loggedIn) {
            return {
                role: this.roleName,
                pagesVisited: 0,
                formsFound: 0,
                formsFuzzed: 0,
                apisDiscovered: 0,
                apisProbed: 0,
                bugsFound: detector.getBugs(),
                durationMs: Date.now() - startTime,
                pageGraph: [],
            };
        }
        // 1. General Live Crawl (BFS)
        const pageGraph = await crawler.crawl(page, this.roleName, fuzzer, detector, enableA11y, enableFuzzing);
        // 2. Custom Role-Specific Explorations
        await this.runCustomExploration(page, detector);
        // 3. Session Expiry Test (§29)
        await detector.testSessionExpiry();
        return {
            role: this.roleName,
            pagesVisited: pageGraph.length,
            formsFound: pageGraph.reduce((acc, p) => acc + p.formsFound.length, 0),
            formsFuzzed: pageGraph.reduce((acc, p) => acc + p.formsFound.length, 0),
            apisDiscovered: detector.getDiscoveredEndpoints().length,
            apisProbed: 0,
            bugsFound: detector.getBugs(),
            durationMs: Date.now() - startTime,
            pageGraph,
        };
    }
}
exports.RoleStrategy = RoleStrategy;
