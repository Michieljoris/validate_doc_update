function (newDoc, oldDoc, userCtx, secObj){
    if (!secObj) return;

    log('in vdu, oldDoc is:' + JSON.stringify(oldDoc, null, '\t'));
    log('in vdu, newDoc is:' + JSON.stringify(newDoc, null, '\t'));
    
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
    
    var validator = require('validator');
    
    try {
        validator = validator.init(secObj.members.names, userCtx);
    }  catch(e) {
        log('error initing validator', e);
        if (e.message) reportError('forbidden', 'Error initializing validator: \n' + e.message);
        else reportError('forbidden', 'Error initializing validator: \n' + e.source + '\n ' + e.error);
    }
        
    function is_admin(){
        return userCtx.roles.indexOf('_admin') !== -1;
    }
    
    function validateDoc(doc) {
        return validator.validateDoc(doc);
    }
    
    if (is_admin()) {
        if (newDoc._deleted) return;
        if (!validateDoc(newDoc)) 
            reportError('forbidden', 'The document is not validated (even admins can\'t get around this :-).');
        return;
    } 
    
    function hasWritePermission() {
        var roles = secObj.members.roles;
        
        for (var i = 0; i < roles.length; i++) {
            if (roles[i].indexOf('write') === 0) {
                if (userCtx.roles.indexOf(roles[i]) !== -1) return true;
            }
        }
        return false;
    }
    
    if (!hasWritePermission())
        reportError('unauthorized', 'User ' + userCtx.name  +
                    ' is not allowed to write to this database.');
    
    if (newDoc._deleted) {
        if  (!validator.validateUser(oldDoc, {}) )
            reportError('unauthorized', 'User ' + userCtx.name + ' is not allowed to delete this particular document to the database.');
    }
    else {
        if  (!validator.validateUser(newDoc, oldDoc) )
            reportError('unauthorized', 'User ' + userCtx.name + ' is not allowed to write this particular document to the database.');
        if (!validator.validateDoc(newDoc))
            reportError('forbidden', 'The document is not conforming to the validation rules.');
    }
}

