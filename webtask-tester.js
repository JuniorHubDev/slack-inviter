require('dotenv').config();
const mockRes = require('mock-res');
const mockReq = require('mock-req');

const webtask = require(`./${process.argv[2]}`);

const context = {
    secrets: process.env
}

const request = new mockReq({
    method: 'POST'
});
const response = new mockRes();

let body = '';

response.on('data', (data) => {
    body += data;
})

response.on('finish', () => {
    console.log(JSON.stringify(response.getHeaders(), null, 2));
    console.log(body);
})

webtask(context, request, response);

request.write('name=Luke%20Bonaccorsi&age=29')
request.end();


