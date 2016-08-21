/*
SETUP IP TABLE

echo 1 > /proc/sys/net/ipv4/ip_forward
iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE 
iptables -A FORWARD -i wlan0 -o eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i eth0 -o wlan0 -j ACCEPT
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to 9090
*/

var http = require('http');
var fs = require('fs');
var URL = require('url');
var path = require('path');
var send = require('send');

var logStream = fs.createWriteStream('log.txt', {'flags': 'a'});


http.createServer(function(request, response) {
  var pathName = URL.parse(request.url).pathname;
  if (pathName.endsWith('.pkg')) {
    var cacheFile = 'cache/' + path.basename(pathName);
    
    fs.stat(cacheFile, function(err, stat) {
      if (err) {
        handleProxy(request, response);
      } else {
        console.log('SERVING ' + cacheFile);
        handleCache(request, response, cacheFile, stat);
      }
    });
  }
  else {
    handleProxy(request, response);
  }
}).listen(9090);

function handleCache(request, response, fileName, stat) {
  send(request, fileName, {etag: false})
    .on('headers', function(res, path, stat) {
      res.setHeader('content-type', 'application/octet-stream');
    })
    .pipe(response);
}


function handleProxy(request, response) {
  var proxy = http.createClient(80, request.headers['host']);
  var proxy_request = proxy.request(request.method, request.url, request.headers);
  proxy_request.addListener('response', function (proxy_response) {
    proxy_response.addListener('data', function(chunk) {
      response.write(chunk, 'binary');
    });
    proxy_response.addListener('end', function() {
      response.end();
    });
    if (proxy_response.headers['content-length'] > 100000000) {
      writeLog('http://' + request.headers['host'] + request.url);
      writeHeaders(request.headers, '> ');
      writeHeaders(proxy_response.headers, '< ');
      writeLog('--------------------\n');
    } 
    response.writeHead(proxy_response.statusCode, proxy_response.headers);
  });
  request.addListener('data', function(chunk) {
    proxy_request.write(chunk, 'binary');
  });
  request.addListener('end', function() {
    proxy_request.end();
  });
}

function writeLog(text) {
  console.log(text);
  logStream.write(text + "\n");
}

function writeHeaders(headers, prefix) {
  for (var name in headers) {
    writeLog(prefix + name + ': ' + headers[name]);
  }
}

