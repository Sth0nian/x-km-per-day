const readline = require('readline');

class StravaOAuthSetup {
    constructor() {
        this.clientId = process.env.STRAVA_CLIENT_ID;
        this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
        
        if (!this.clientId || !this.clientSecret) {
            console.error('Please set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables');
            process.exit(1);
        }
    }

    async setup() {
        console.log('🏃‍♂️ Strava OAuth Setup');
        console.log('====================\n');
        
        console.log('This script will help you get your Strava refresh token for the GitHub Action.\n');
        
        // Step 1: Generate authorization URL
        const authUrl = this.generateAuthUrl();
        console.log('Step 1: Visit this URL to authorize your application:');
        console.log('\x1b[36m%s\x1b[0m', authUrl);
        console.log('\nAfter authorizing, you will be redirected to a URL that looks like:');
        console.log('your-username.github.io/strava-running-dashboard?state=&code=AUTHORIZATION_CODE&scope=read,activity:read_all');
        console.log('\nCopy the "code" parameter from the redirect URL.\n');
        
        // Step 2: Get authorization code from user
        const authCode = await this.getAuthCodeFromUser();
        
        // Step 3: Exchange for access token and refresh token
        console.log('\nExchanging authorization code for tokens...');
        const tokens = await this.exchangeCodeForTokens(authCode);
        
        // Step 4: Display results
        console.log('\n✅ Success! Here are your tokens:');
        console.log('=================================');
        console.log(`Access Token: ${tokens.access_token}`);
        console.log(`Refresh Token: ${tokens.refresh_token}`);
        console.log(`Expires At: ${new Date(tokens.expires_at * 1000)}`);
        console.log(`Athlete ID: ${tokens.athlete.id}`);
        console.log(`Athlete Name: ${tokens.athlete.firstname} ${tokens.athlete.lastname}`);
        
        console.log('\n📝 Next Steps:');
        console.log('==============');
        console.log('1. Go to your GitHub repository settings');
        console.log('2. Navigate to Settings → Secrets and variables → Actions');
        console.log('3. Add these repository secrets:');
        console.log('   - STRAVA_CLIENT_ID:', this.clientId);
        console.log('   - STRAVA_CLIENT_SECRET:', this.clientSecret);
        console.log('   - STRAVA_REFRESH_TOKEN:', tokens.refresh_token);
        console.log('\n4. Enable GitHub Pages in your repository settings');
        console.log('5. Push your code and the GitHub Action will run automatically!');
        
        // Test the token
        console.log('\n🧪 Testing your access...');
        await this.testToken(tokens.access_token);
    }

    generateAuthUrl() {
        const scopes = 'read,activity:read_all';
        const redirectUri = 'https://your-username.github.io/strava-running-dashboard'; // Update this
        const state = 'github_action_setup';
        
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            approval_prompt: 'force',
            scope: scopes,
            state: state
        });
        
        return `https://www.strava.com/oauth/authorize?${params.toString()}`;
    }

    async getAuthCodeFromUser() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question('Enter the authorization code from the redirect URL: ', (code) => {
                rl.close();
                resolve(code.trim());
            });
        });
    }

    async exchangeCodeForTokens(authCode) {
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: authCode,
                grant_type: 'authorization_code'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to exchange code for tokens: ${response.status} ${error}`);
        }

        return await response.json();
    }

    async testToken(accessToken) {
        try {
            // Test by fetching athlete info
            const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!athleteResponse.ok) {
                throw new Error(`Failed to fetch athlete: ${athleteResponse.status}`);
            }

            const athlete = await athleteResponse.json();
            console.log(`✅ Successfully connected to ${athlete.firstname} ${athlete.lastname}'s account`);

            // Test by fetching a few activities
            const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!activitiesResponse.ok) {
                throw new Error(`Failed to fetch activities: ${activitiesResponse.status}`);
            }

            const activities = await activitiesResponse.json();
            const runningActivities = activities.filter(a => a.type === 'Run');
            
            console.log(`✅ Found ${activities.length} recent activities (${runningActivities.length} runs)`);
            
            if (runningActivities.length > 0) {
                const latest = runningActivities[0];
                console.log(`   Latest run: "${latest.name}" - ${(latest.distance / 1609.34).toFixed(2)} miles on ${new Date(latest.start_date).toLocaleDateString()}`);
            }

        } catch (error) {
            console.error('❌ Error testing token:', error.message);
            console.log('The tokens were generated but there might be an issue with permissions.');
        }
    }
}

// Additional helper functions
function displayTroubleshooting() {
    console.log('\n🔧 Troubleshooting:');
    console.log('===================');
    console.log('• Make sure your Strava app settings have the correct Authorization Callback Domain');
    console.log('• Update the redirect URI in this script to match your GitHub Pages URL');
    console.log('• Ensure you have the required scopes: read,activity:read_all');
    console.log('• If you get a 400 error, double-check your client credentials');
    console.log('\n📚 Useful Links:');
    console.log('• Strava API Documentation: https://developers.strava.com/docs/getting-started/');
    console.log('• Strava App Settings: https://www.strava.com/settings/api');
    console.log('• GitHub Actions Documentation: https://docs.github.com/en/actions');
}

// Run the setup
if (require.main === module) {
    const setup = new StravaOAuthSetup();
    setup.setup().catch(error => {
        console.error('\n❌ Setup failed:', error.message);
        displayTroubleshooting();
        process.exit(1);
    });
}

module.exports = StravaOAuthSetup;