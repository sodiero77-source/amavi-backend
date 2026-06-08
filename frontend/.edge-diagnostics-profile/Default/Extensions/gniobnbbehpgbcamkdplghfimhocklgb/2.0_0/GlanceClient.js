 
var hostName = "net.glance.client";
  
function logMessage(m) {
     console.log(m);
}

// NativeClientProxy --------------------------------------------
//
// Proxies messages to native client on behalf of web page
//
function NativeClientProxy(hostName, request, sendResponse) {
    this.hostName = hostName;
    this._sendNativeMessage(request, sendResponse);
}

NativeClientProxy.prototype._connect = function() {
    logMessage("Connecting to native messaging host:" + hostName);

    var self = this;

    this.port = chrome.runtime.connectNative(this.hostName);
    this.port.onMessage.addListener(function (message) { self._onNativeMessage(message); });
    this.port.onDisconnect.addListener(function () { self._onDisconnected(); });
}

NativeClientProxy.prototype._sendNativeMessage = function(message, sendResponse) {
    if (!this.port)
        this._connect();
    this.sendResponse = sendResponse;
    this.port.postMessage(message);
    logMessage("Sent :" + JSON.stringify(message));
}

NativeClientProxy.prototype._onNativeMessage = function(message) {
    logMessage("Received :" + JSON.stringify(message));

    if (this.sendResponse)
        this.sendResponse(message);

    this.port.disconnect();
}

NativeClientProxy.prototype._onDisconnected = function() {
    logMessage("Failed to connect: " + chrome.runtime.lastError.message);
    this.port = null;
    this.sendResponse({ nativeClientDisconnected: chrome.runtime.lastError.message });
}

chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        logMessage("Got request " + JSON.stringify(request));
        var nativeClientProxy = new NativeClientProxy(hostName, request, sendResponse);
        return true; // indicates will call sendResponse later
  });    

