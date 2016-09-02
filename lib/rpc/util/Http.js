var Request = require('request');

//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
var HttpClient = function() {};

HttpClient.prototype = {
    get: function() {
        return HttpClient.get.apply(this, arguments);
    },
    post: function() {
        return HttpClient.post.apply(this, arguments);
    }
};

//-----------------------------------------------------------------------------------------------
// Get请求
//-----------------------------------------------------------------------------------------------
HttpClient.get = function() {};

//-----------------------------------------------------------------------------------------------
// Post请求
//-----------------------------------------------------------------------------------------------
HttpClient.post = function(url, data) {
    return new Promise(function(resolve, reject) {
        Request({
            url: url,
            method: 'post',
            form: JSON.stringify(data),
            headers: {
                "Content-type": "application/json-rpc",
                "Accept": "text/json"
            }
        }, function(err, response, body) {
            if (err) {
                reject(err);
            } else {
                body = JSON.parse(body);
                if (body.error) {
                    reject(body.error);
                } else {
                    resolve(body.result);
                }
            }
        });
    });
};


//-----------------------------------------------------------------------------------------------
//
//
//
//
//
//-----------------------------------------------------------------------------------------------
module.exports = HttpClient;
