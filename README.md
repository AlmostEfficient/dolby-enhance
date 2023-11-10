# dolby-enhance
Implementation of the Dolby enhance API for local files 

## Setup
1. Install the requirements
```
pnpm install
```

2. Create a `.env` file with the following content:
```
APP_KEY
APP_SECRET
```

Get these from https://dashboard.dolby.io/

3. Set content type and file name in main.js
```
const contentType = "studio";
const localInputFilePath = "1101.mp3";
```

Files can be MP3 or MP4.

4. Run the script 
```
node main.js
```