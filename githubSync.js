const axios = require('axios');
require('dotenv').config();

const { 
    GITHUB_TOKEN, 
    GITHUB_OWNER, 
    GITHUB_REPO, 
    GITHUB_PATH, 
    GITHUB_BRANCH 
} = process.env;

const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;

let fileSHA = null; 

const githubSync = {
    // PULL: Get data from GitHub
    async pull() {
        try {
            const response = await axios.get(GITHUB_API_URL, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });
            
            fileSHA = response.data.sha; 
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            
            // This parses the raw text from GitHub into a JSON object
            return JSON.parse(content);
        } catch (error) {
            console.error("❌ Cloud Pull Failed:", error.message);
            return null;
        }
    },

    // PUSH: Save data back to GitHub
    async push(data) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            const base64Content = Buffer.from(jsonString).toString('base64');

            const response = await axios.put(GITHUB_API_URL, {
                message: `Kingdom Update: ${new Date().toLocaleString()}`,
                content: base64Content,
                sha: fileSHA,
                branch: GITHUB_BRANCH
            }, {
                headers: { Authorization: `token ${GITHUB_TOKEN}` }
            });

            fileSHA = response.data.content.sha; 
            console.log("✅ Kingdom State Saved to grp-chat/textfiles!");
        } catch (error) {
            console.error("❌ Cloud Push Failed:", error.response?.data || error.message);
        }
    }
};

module.exports = githubSync;