/*global console:false require:false */
/*jshint globalstrict:true*/

"use strict";

var validator = require('./validator.js');

var parsingError;
function test(newDoc, oldDoc, userCtx, dbRules){
    
    var module;
    try {
        module = validator.init(dbRules, userCtx);
    }  catch(e) {
        parsingError = 'Error initializing validator: \nRule:"' + e.source + '"\nError:' + e.error;
        return;
    }
    if (userCtx && !dbRules)
        return module.validateUser(newDoc, oldDoc);
    if (!userCtx && dbRules)
        return module.validateDoc(newDoc);
    return module.validateUser(newDoc, oldDoc) && module.validateDoc(newDoc);
}

var count = 0, failed = 0;
function assert(newDoc, oldDoc, userCtx, dbRules, expect) {
    count++;
    var result = test(newDoc, oldDoc, userCtx, dbRules);
    if ( result !== expect) {
        failed++;
        if (parsingError) {
            console.log(parsingError);   
            parsingError = false;
        }
        else console.log('EXPECTING ' + (expect ? 'PASS' : 'FAIL') + '\n',
                    { newDoc: newDoc, oldDoc: oldDoc, userCtx: userCtx, dbRules: dbRules});
    }
}

function PASS() {
    var args = Array.prototype.slice.call(arguments);
    if (0 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(true);
    assert.apply(null, args);
}

function FAIL() {
    var args = Array.prototype.slice.call(arguments);
    if (0 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(false);
    assert.apply(null, args);
}

function UNDEFINED() {
    var args = Array.prototype.slice.call(arguments);
    if (0 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(undefined);
    assert.apply(null, args);
}

// var filter = true;
var filter = false;

var tests = [
    //test db validation rules
    function() {
        //if there are no dbrules, writing is not allowed by default
        var dbRules =  [];
        FAIL( { type:'location', id:"user" }, { }, null, dbRules);
    }, 
    function() {
        //validate docs based on fixed value keys and type of value of a key
        var dbRules =  [
            "_type:'location', location:'bla2'",
            "_astring:string",
            "_obj:object",
            "_array: array",
            "_number: number",
            "_type:'location', location:'bla'"
        ];
        
        PASS( { type:'location', location:'bla' }, { }, null, dbRules);
        PASS( { type:'location', location:'bla2' }, { }, null, dbRules);
        FAIL( { type:'location', location:'bla3' }, { }, null, dbRules);
        FAIL( { type:'location2', location:'bla' }, { }, null, dbRules);
        
        FAIL( { }, { }, null, dbRules);
        FAIL( { type:'noway' }, { }, null, dbRules);
        FAIL( { location:'noway' }, { }, null, dbRules);
        FAIL( { location:'noway', type:'noway' }, { }, null, dbRules);
        
        PASS(0, { astring:'some string' }, { }, null, dbRules);
        FAIL(0, { astring: 123 }, { }, null, dbRules);
        
        FAIL(0, { obj:'some string' }, { }, null, dbRules);
        PASS(0, { obj: { a: 1}}, { }, null, dbRules);
        
        FAIL(0, { number:'some string' }, { }, null, dbRules);
        PASS(0, { number: 123 }, { }, null, dbRules);
        
        PASS(0, { array:[1,2,3] }, { }, null, dbRules);
        FAIL(0, { array: 123 }, { }, null, dbRules);
    },
    //don't know if they're useful, but added nonetheless
    //test for existence and being defined of a key:
    function() {
        var dbRules =  [
            "_defined: defined"
        ];
        
        FAIL(0, { defined:undefined }, { }, null, dbRules);
        FAIL(0, { }, { }, null, dbRules);
        PASS(0, { defined: 123}, { }, null, dbRules);
    },
    
    function() {
        var dbRules =  [
            "_illegal: illegal"
        ];
        
        FAIL(0, { illegal: 123}, { }, null, dbRules);
        FAIL(0, { illegal: undefined}, { }, null, dbRules);
        PASS(0, { }, { }, null, dbRules);
    },
    
    function() {
        var dbRules =  [
            "_notdefined: notdefined"
        ];
        
        PASS(0, { notdefined:undefined}, { }, null, dbRules);
        PASS(0, { }, { }, null, dbRules);
        FAIL(0, { notdefined: 123 }, { }, null, dbRules);
    },
    
    //test user allow rules
    function() {
        //only fixed values
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_| ONLY: id"
            ]
        };
        PASS( { id:"user" }, { }, userCtx, null);
    }, 
    function() {
        //only fixed values
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', id:user"
            ]
        };
        PASS( { type:'location', id:"user" }, { }, userCtx, null);
    }, 
    function() {
        //if there are no allow rules for the user, writing is not allowed by default
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
            ]
        };
        FAIL( { type:'location', id:"user" }, { }, userCtx, null);
    }, 
    function() {
        //syntax errors:
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow__type:'location', id:user|  ONLY: salt, key"
            ]
        };
        
        UNDEFINED( { type:'location', id:"user" }, { }, userCtx, null);
        userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type'location', id:user|  ONLY: salt, key"
            ]
        };
        
        UNDEFINED( { type:'location', id:"user" }, { }, userCtx, null);
        
        userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', id:user|  ONLY salt, key"
            ]
        };
        
        UNDEFINED( { type:'location', id:"user" }, { }, userCtx, null);
    },
    function() {
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', id:user|  ONLY: salt, key"
            ]
        };
        
        PASS( { type:'location', id:"user" }, { }, userCtx, null);
        PASS( { type:'location', id:"user" , salt:1}, { }, userCtx, null);
        PASS( { type:'location', id:"user" , salt:1, key:'bla'}, { }, userCtx, null);
        
        FAIL( { type:'location' }, { }, userCtx, null);
        FAIL( { type:'somelocation', id:"user", salt:1, key:2, somekey:1 }, { }, userCtx, null);
    },
    function() {
        //disallow certain keys
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', id:user | NOT: salt, key"
            ]
        };
        
        PASS( { type:'location', id:"user" }, { }, userCtx, null);
        PASS( { type:'location', id:"user" , somekey:1 }, { }, userCtx, null);
        
        FAIL( { type:'location', id:"user" , salt:1}, { }, userCtx, null);
        FAIL( { type:'location', id:"user" , salt:1, key:'bla'}, { }, userCtx, null);
        FAIL( { type:'location' }, { }, userCtx, null);
        FAIL( { type:'somelocation', id:"user", salt:1, key:2, somekey:1 }, { }, userCtx, null);
    },
    function() {
        //allow only a certain database
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_mydb_type:'location', id:user | NOT: salt, key"
            ]
        };
        PASS( { type:'location', id:"user" }, { }, userCtx, null);
    },
    function() {
        //allow rule doesn't apply to this mydb
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_somedb_type:'location', id:user | NOT: salt, key"
            ]
        };
        FAIL( { type:'location', id:"user" }, { }, userCtx, null);
        
    },
    function() {
        //document is not referring to the user (in the _id key for this rule)
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', _id:user| NOT: salt, key"
            ]
        };
        FAIL( { type:'location', _id:"someUser"}, { }, userCtx, null);
        
    },
    function() {
        //
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', _id:user| NOT: salt, key",
                "allow_*_type:'t2', _id:user| NOT:"
            ]
        };
        FAIL( { type:'location', _id:"user" ,salt:1}, { }, userCtx, null);
        PASS( { type:'t2', _id:"user" ,salt:1}, { }, userCtx, null);
        
    }
];

    
    tests.forEach(function(t) {
        try{
            t();
        } catch(e) {
    console.log('error', e);
}
    }); 
    

console.log('\n--------------------------------------');
console.log('Completed ' + count + ' tests');
console.log('Failed: ' + failed + ' tests');
console.log('--------------------------------------');
