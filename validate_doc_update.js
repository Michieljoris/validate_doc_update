/*global require:false log:false*/

function (newDoc, oldDoc, userCtx, secObj){
    "use strict";  
    
    if (!secObj) return;
    
    secObj.members = secObj.members || {};
    secObj.members.roles = secObj.members.roles || [];
    secObj.members.names = secObj.members.names || [];
    
    function reportError(type, error_msg) {
        log('Error writing document `' + newDoc._id +
            '\' to the database: ' + error_msg);
        var errorObj = {};
        errorObj[type] = error_msg;
        throw(errorObj);
    }
    
    var validator;
    try {
        validator = require('validator').init(secObj.members.names, userCtx);
    }  catch(e) {
        reportError('forbidden', 'Error initializing validator: \n' + e.source + '\n ' + e.error);
    }
        
    function is_admin(){
        return userCtx.indexOf('_admin') !== -1;
    }
    
    function validateDoc(doc) {
        return validator.validateDoc(doc);
    }
    
    if (is_admin()) {
        if (!validateDoc(newDoc)) 
            reportError('forbidden', 'The document is not validated (even admins can\'t get around this..).');
        return;
    } 
    
    function hasWritePermission() {
        var roles = secObj.members.roles;
        for (var i; i < roles.length; i++) {
            if (roles[i].indexOf('write') === 0) {
                if (userCtx.roles.indexOf(roles[i]) !== -1) return true;
            }
        }
        return false;
    }
    
    if (!hasWritePermission())
        reportError('unauthorized', 'User ' + userCtx.name  +
                    'is not allowed to write to this database.');
    
    if  (!validator.validateUser(newDoc, oldDoc) )
        reportError('unauthorized', 'User ' + userCtx.name + ' is not allowed to write this particular document to the database.');
    
    if (!validator.validateDoc(newDoc))
        reportError('forbidden', 'The document is not conforming to the validation rules.');
}
