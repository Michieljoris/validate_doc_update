/*global console:false exports:false */
/*jshint globalstrict:true*/

"use strict";

var validateDoc;
var cachedRules;
var validateUser;
var cachedUserCtx;


function isArray(value) {
    return Object.prototype.toString.apply(value) === '[object Array]';
}

function isDate(value){
    return Object.prototype.toString.apply(value) === '[object Date]';
}

//adapted from angular.equals
function equals(o1, o2) {
    if (o1 === o2) return true;
    if (o1 === null || o2 === null) return false;
    if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
    var t1 = typeof o1, t2 = typeof o2, length, key, keySet;
        if (t1 === t2) {
            if (t1 === 'function') {
                return t1.toString() === t2.toString();
            }
            else if (t1 === 'object') {
                if (isArray(o1)) {
                    if (!isArray(o2)) return false;
                    if ((length = o1.length) === o2.length) {
                        for(key=0; key<length; key++) {
                            if (!equals(o1[key], o2[key])) return false;
                        }
                        return true;
                        
                    }
                } else if (isDate(o1)) {
                    return isDate(o2) && o1.getTime() === o2.getTime();
                } else {
                    if (isArray(o2)) return false;
                    keySet = {};
                    for(key in o1) {
                        if (!equals(o1[key], o2[key])) return false;
                        keySet[key] = true;
                    }
                    for(key in o2) {
                        if (!keySet.hasOwnProperty(key) &&
                            o2[key] !== undefined ) return false;
                    }
                    return true;
                }
            }
        }
    return false;
}

//these functions can be used in the db rules
function defined(doc, key) { return typeof doc[key] !== 'undefined'; }
function array(doc, key) { return isArray(doc[key]); }
function string(doc, key) { return typeof doc[key] === 'string'; }
function object(doc, key) {
    var toString = Object.prototype.toString.apply(doc, key);
    return typeof doc[key] === 'object' &&
        toString !== '[object Array]' &&
        toString !== '[object Date]';}
function date(doc, key) { return isDate(doc[key]); }
function number(doc, key) { return typeof doc[key] === 'number'; } 
function notdefined(doc, key) { return typeof doc[key] === 'undefined'; }
function illegal(doc, key) {
    for (var k in doc) {
        if (k === key) return false;
    }
    return true;
}

//eval the rule and insert functions for fixed values
function parseDbRule(rule) {
    rule = 'rule = {' + rule + '}';
    try { eval(rule); } catch(e) {
        throw({ source: rule, error: e.message });
    }
    
    function makeTestFixedValueFunction(key, fixedValue) {
        return function(doc) {
            return doc[key] === fixedValue;
        };
    };
    
    var bind = function(f, key) {
        return function(doc) {
            return f(doc, key);
        };
    };
    
    for (var k in rule) {
        if (typeof rule[k] !== 'function') 
            rule[k] = makeTestFixedValueFunction(k, rule[k]);
        else
            rule[k] =  bind(rule[k], k);
    }
    
    return rule;
} 


function combineRuleTests(tests) {
    var ruleAsOneTest = function(doc) {
        for (var key in tests) {
            if (!tests[key](doc)) return false; }
        return true;
    };
    return ruleAsOneTest;
}

function compileRules(rules) {
    cachedRules = rules;
    var tests = rules.filter(function(r) {
        return r.indexOf('_') === 0;
    }).map(function(r) {
        r = parseDbRule(r.slice(1));
        return combineRuleTests(r);
    });
    validateDoc = function(doc) {
        for (var i = 0; i < tests.length; i++) {
            if (tests[i](doc)) return true;
        }
        return false;
    };
    return validateDoc;
}

//////--------------------------------------

function parse(rule, user) {
    //user might be used in the eval..
    var dq = '"', ignoreQuote, inQuote, objStr, keysString, ch;
    
    for (var i=0; i < rule.length; i++) {
        ch = rule[i];
        if (ch === dq && !ignoreQuote) {
            inQuote = !inQuote;
        } 
        else if (inQuote) {
            if (ch === '\\') ignoreQuote = true;
            else ignoreQuote = false;
        } 
        else if (ch === '|' && !inQuote) {
            objStr = rule.slice(0, i);
            keysString = rule.slice(i + 1);
            break;
        }
    }
    
    var obj;
    var str = 'obj = {' + objStr + '}';
    try { eval(str); } catch(e) {
        throw({ source: objStr, error: e.message });
    }
    
    var colonPos = keysString.indexOf(':');
    if (colonPos === -1)
        return { rule: rule, error: 'colon missing'};
    var type = keysString.slice(0, colonPos).
        indexOf('NOT') === -1 ? 'only': 'not';
    keysString = keysString.slice(colonPos + 1);
    
    var keys = [];
    var key = [];
    var state = 'waitingForNextKey';
    
    for (i=0; i < keysString.length; i++) {
        ch = keysString[i];
        if (state === 'readLiteral') {
                state = 'parsingQuotedKey';
            key.push(ch);   
        }
        else if (state === 'parsingQuotedKey') {
            if (ch === '\\') state = "readLiteral";
            else if (ch === dq) {
                keys.push(key.join(''));
                state = 'waitingForNextKey';
            }
            else key.push(ch); } 
        else if (state === 'parsingKey') {
            if (ch === ' ') {
                keys.push(key.join(''));
                state = 'waitingForNextKey';
            }
            else key.push(ch); 
        } 
        else if (state === 'waitingForNextKey') {
            if (ch === ' ') ;
            else { key = [];
                   if (ch === dq) state = 'parsingQuotedKey';
                   else { key.push(ch);
                          state = 'parsingKey';   
                        }
                 }
        }
    }
    
    if (state === 'parsingQuotedKey')
        throw { source: rule, error: 'ending quote missing' };
    if (state === 'parsingKey') keys.push(key.join(''));
    
    return { rule: rule, fixedValues: obj, type: type, keys: keys };
}

function getAllowedRules(array, currentDb) {
    array = array || [];
    var rules = [];
    array.forEach(function(r) {
        var isRule =  r.indexOf( 'allow_') === 0;
        if (isRule) {
            var nextUnderScore = r.indexOf('_', 7);
            var db = r.slice(6,nextUnderScore);
            if (db === '*' || db === currentDb)
                rules.push(r.slice(nextUnderScore + 1));
        }
    });
    return rules;
} 


function getUserTest(r) {
    var test = {};
    test.only = function(newDoc, oldDoc) {
        var key;
        for (key in r.fixedValues) oldDoc[key] = r.fixedValues[key];
        for (var i = 0; i < r.keys.length; i++) {
            var what = r.keys[i];
            console.log(i, r.keys[i], newDoc, newDoc.salt, what, newDoc[what]);
            oldDoc[r.keys[i]] = newDoc[r.keys[i]];
        }
        console.log(oldDoc, newDoc);
        return equals(newDoc, oldDoc);
    };
    
    test.not = function(newDoc, oldDoc) {
        var key;
        for (key in r.fixedValues) {
            if (!equals(newDoc[key], r.fixedValues[key])) return false;
        }
        for (key in r.keys) {
            if (!equals(newDoc[key], oldDoc[key])) return false;
        } 
        return true;
    };
    
    return test[r.type];
}

function compileUserCtx(userCtx) {
    var user = userCtx.name;
    var allowedRules = getAllowedRules(userCtx.roles, userCtx.db);
    
    allowedRules = allowedRules.map(function(r) {
        var parsed = parse(r, user);
        parsed.test = getUserTest(parsed);
        return parsed;
    });
    console.log('allowedRules', allowedRules);
    
    cachedUserCtx =userCtx;
    validateUser = function(newDoc, oldDoc) {
        for (var i = 0; i < allowedRules.length; i++) {
            if (allowedRules[i].test(newDoc, oldDoc)) return true;
        }
        return false;
    };
    return validateUser;
}


function init(dbRules, userCtx) {
    
    return {
        // validateDoc: equals(dbRules, cachedRules)  ? validateDoc : compileRules(dbRules),
        validateUser: equals(userCtx, cachedUserCtx)  ? validateDoc : compileUserCtx(userCtx)
    };
}

// exports.init = init;


// var a = "type:'loc|ation', id:user | NOT: salt, key" 


// var tst = {
//     f1: "str", f2: 123, f2a: [1,2,3] //literals
//     ,f3: defined, //typeof f3 !== 'undefined'
//     f4:array, f5:string, f6:date, f7:object, f8:number, //type
//     f9:illegal, //not even the key can exist
//     f10:notdefined //key can exist, but cannot have a value
// };


var userCtx = {
    name: 'user',
    db:'mydb',
    roles: [
        "allow_*_type:'location', id:user | ONLY: salt, key"
        
    ]
};

var validator = init(null, userCtx);
var result = validator.validateUser({ type:'location', id:"user" , salt:1}, { type:'location', id:"user" });
console.log('validateUser?', result);

