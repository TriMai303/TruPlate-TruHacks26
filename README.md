## How to run locally

**Requirements:** Node.js installed on your machine

1. Clone the repo
   git clone https://github.com/TriMai303/TruPlate-TruHacks26.git
2. Navigate into the project folder
   cd TruPlate-TruHacks26
3. Install dependencies
   npm install
4. Create a `.env` file in the root folder and add your Groq API key
   GROQ_API_KEY=your_groq_key_here
   Get a free API key at **console.groq.com**
5. Start the backend server
   npm start
6. Open `index.html` with Live Server in VS Code
   - Install the Live Server extension if you haven't
   - Right-click `index.html` → Open with Live Server
   - App opens at `http://127.0.0.1:5500/index.html`
7. In the app, select a date and meal period, click **Load Live Menu**, enter your nutrition goals, and hit **Design My Meal**
