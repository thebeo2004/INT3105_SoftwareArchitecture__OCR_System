import http from 'k6/http';
import { sleep, check } from 'k6';
import { Trend} from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = 'http://localhost:5000';
const ENDPOINT = '/upload';

const IMAGE_PATH = '../data/sample.png'; 

const requestDuration = new Trend('k6_request_duration', true);

const imageFileNames = ['sample.png', 'sample1.jpg', 'sample2.jpg', 'sample3.jpg', 'sample4.jpg', 'sample5.jpg', 'sample6.jpg', 'sample7.jpg'];

const imageFiles = [];
for (const filename of imageFileNames) {

  const imagePath = `../data/${filename}`;
  try {
    const fileContent = open(imagePath, 'b');
    
    imageFiles.push({ name: filename, content: fileContent });
  } catch (e) {
    
    console.error(`INIT ERROR opening file ${imagePath}: ${e}`);
  }
}

if (imageFiles.length === 0) {
  throw new Error('No image files could be loaded. Check paths and file existence in the init stage.');
}

// --- Helper function to determine Content-Type from filename ---
function getContentType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    // Add other types if needed
    default:
      return 'application/octet-stream'; // Default if unknown
  }
}

// Testing scenarios
export const options = {

    // // Kịch bản 1: Kiểm thử Cơ bản (Baseline Test)
    // scenarios: {
    //   baseline: {
    //     executor: 'constant-arrival-rate', 
    //     // 1 request per second
    //     rate: 1, 
    //     timeUnit: '1s',
    //     // Duration of scenario
    //     duration: '5m', 
    //     // There are always 5 VUs and this number might reach 10
    //     preAllocatedVUs: 5, 
    //     maxVUs: 10, 
    //     exec: 'uploadFile', 
    //   },
    // },

    // // Kịch bản 2: Kiểm thử Tải Tăng dần (Ramp-up Load Test)
    // scenarios: {
    //   ramp_up: {
    //     executor: 'ramping-vus', 
    //     startVUs: 0,
    //     stages: [
    //       { duration: '2m', target: 10 }, 
    //       { duration: '3m', target: 10 }, 
    //       { duration: '2m', target: 30 }, 
    //       { duration: '3m', target: 30 }, 
    //       { duration: '2m', target: 50 }, 
    //       { duration: '5m', target: 50 }, 
    //       { duration: '2m', target: 0 },  
    //     ],
    //     gracefulRampDown: '30s', 
    //     exec: 'uploadFile',
    //   },
    // },

    // // Kịch bản 3: Kiểm thử Sức chịu đựng (Stress Test)
    // scenarios: {
    //   stress: {
    //     executor: 'ramping-vus',
    //     startVUs: 0,
    //     stages: [
    //       { duration: '1m', target: 100 }, 
    //       { duration: '5m', target: 100 }, 
    //       { duration: '1m', target: 0 },   
    //     ],
    //     gracefulRampDown: '30s',
    //     exec: 'uploadFile',
    //   },
    // },

    // // Kịch bản 4: Kiểm thử Ngâm (Soak Test)
    // scenarios: {
    //   soak: {
    //     executor: 'constant-vus', 
    //     vus: 30, 
    //     duration: '1h', 
    //     gracefulStop: '5m', 
    //     exec: 'uploadFile',
    //   },
    // },

    // Setting thresholds 
    thresholds: {
      'http_req_failed': ['rate<0.05'], 
      'http_req_duration': ['p(95)<5000'], 
      'k6_request_duration': ['p(95)<5000'], 
      'checks': ['rate>0.99'], // Thêm check để đảm bảo phần lớn kiểm tra thành công
    },
};


export function uploadFile () {
    const url = `${BASE_URL}${ENDPOINT}`;

    const randomFile = randomItem(imageFiles);

    const contentType = getContentType(randomFile.name);

    const data = {
        files: http.file(randomFile.content, randomFile.name, contentType),
    };

    const res = http.post(url, data, {
        tags: {
            filename: randomFile.name,
            contentType: contentType
        }
    });

    requestDuration.add(res.timings.duration);

    check(res, {
        [`[${randomFile.name}] status is 202`]: (r) => r.status === 202,
    });

    sleep(1);
}