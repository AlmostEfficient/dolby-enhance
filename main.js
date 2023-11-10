// implementation of https://docs.dolby.io/media-apis/docs/dolby-media-temporary-cloud-storage
const axios = require('axios').default;
const fs = require('fs');
require('dotenv').config();
const dolbyioRestApisClient = require('@dolbyio/dolbyio-rest-apis-client');

const APP_KEY = process.env.APP_KEY;
const APP_SECRET = process.env.APP_SECRET;

// Options - conference, interview, lecture, meeting, mobile_phone, music, podcast, studio, voice_over
const contentType = "studio";
const localInputFilePath = "1101.mp3"; // Replace with the path to your local MP3 file

const dolbyInputPath = "dlb://local/in/" + localInputFilePath;
// Output as: filename-enhanced-contentType.mp3
const localOutputFilePath = localInputFilePath.replace(".mp3", "-enhanced-" + contentType + ".mp3");
const dolbyOutputPath = "dlb://local/out/" + localInputFilePath.replace(".mp3", "-enhanced-" + contentType + ".mp3");

console.log('Will download from ' + dolbyOutputPath);

const getAccessToken = async () => {
    try {
        const response = await dolbyioRestApisClient.authentication.getApiAccessToken(APP_KEY, APP_SECRET);
        console.log("Authenticated...");
        return response.access_token;
    } catch (error) {
        console.error("Error during authentication:", error);
        throw error;
    }
};

const uploadFile = async (accessToken) => {
    const uploadUrlResponse = await axios({
        method: "post",
        url: "https://api.dolby.com/media/input",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        data: {
            url: dolbyInputPath
        }
    });
    
    const uploadUrl = uploadUrlResponse.data.url;

    await axios({
        method: "put",
        url: uploadUrl,
        data: fs.createReadStream(localInputFilePath),
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": fs.statSync(localInputFilePath).size
        }
    });
    
    console.log("File uploaded successfully.");
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const enhanceAudio = async (accessToken, contentType) => {
    const config = {
        method: "post",
        url: "https://api.dolby.com/media/enhance",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        data: {
            input: dolbyInputPath,
            output: dolbyOutputPath,
            content: {
                type: contentType // e.g., "music", "speech"
            }
        }
    }

    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios(config);
            console.log("Enhancement process started, job ID:", response.data.job_id);

            let result = { status: 'Running', progress: 0 };

            while (result.status === 'Running' && result.progress < 100) {
                result = await checkEnhanceProgress(accessToken, response.data.job_id);
                await sleep(1500);
            }
            
            if (result.status === 'Success') {
                console.log("Enhancement completed successfully.");
                resolve();
            } else {
                console.log("Enhancement failed.");
                reject(new Error("Enhancement failed"));
            }
        } catch (error) {
            console.error("Error in enhancement process:", error);
            reject(error);
        }
    });
};

const checkEnhanceProgress = async (accessToken, jobId) => {
    const config = {
        method: "get",
        url: `https://api.dolby.com/media/enhance`,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        params: {
            job_id: jobId
        }
    }

    try {
        const response = await axios(config);
        const { status, progress } = response.data;

        console.log("Status:", status, "Progress:", progress);

        if (status === 'Error') {
            throw new Error("Enhancement process encountered an error.");
        }

        return { status, progress };
    } catch (error) {
        console.error("Error calling enhance API:", error);
    }
};

const downloadFile = async (accessToken) => {
    // Create a pre-signed URL
    const presignedUrlResponse = await axios({
        method: "post",
        url: "https://api.dolby.com/media/output",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        data: {
            url: dolbyOutputPath
        }
    });

    // Download the file using the pre-signed URL
    const downloadUrlResponse = await axios({
        method: "get",
        url: presignedUrlResponse.data.url,
        responseType: 'stream'
    });

    const writer = fs.createWriteStream(localOutputFilePath);

    downloadUrlResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

const enhanceLocalAudioFile = async () => {
    try {
        const accessToken = await getAccessToken();
        await uploadFile(accessToken);
        
        await enhanceAudio(accessToken, contentType);
        console.log("Processing complete, starting download...");
        
        await downloadFile(accessToken);
        console.log(`Enhanced audio file saved to: ${localOutputFilePath}`);
    } catch (error) {
        console.error("An error occurred:", error);
    }
};

enhanceLocalAudioFile();



