/*global console:false require:false */
/*jshint globalstrict:true*/

"use strict";

var validator = require('./validator.js');

var parsingError;
function test(newDoc, oldDoc, userCtx, dbRules, dbRoles, cachedObjects, expect){
    //returns false, true or undefined
    var module;
    try {
        module = validator.init({ names: dbRules, roles: dbRoles }, userCtx);
    }  catch(e) {
        parsingError = 'Error initializing validator: \nRule:"' + e.source + '"\nError:' + e.error;
        return;
    }
    if (cachedObjects) {
        console.log('Cached:'  + module.cached);
        if (cachedObjects !== module.cached) {
            console.log('Mismatch:!!', cachedObjects,'|', module.cached);
            return false;
        } 
    }
    if (userCtx && !dbRules)
        return module.validateUser(newDoc, oldDoc);
    if (!userCtx && dbRules)
        return module.validateDoc(newDoc);
    return module.validateUser(newDoc, oldDoc) && module.validateDoc(newDoc);
}

var count = 0, failed = 0;
function assert(newDoc, oldDoc, userCtx, dbRules, dbRoles, isCached, expect) {
    count++;
    parsingError = false;
    var result = test(newDoc, oldDoc, userCtx, dbRules, dbRoles, isCached);
    if ( result !== expect) {
        failed++;
        if (parsingError) {
            console.log(parsingError);   
        }
        else console.log(count + ": expecting " + expect + " result: " + result + '\n',
                         { newDoc: newDoc, oldDoc: oldDoc, userCtx: userCtx, dbRules: dbRules});
    }
}

function PASS() {
    var args = Array.prototype.slice.call(arguments);
    if (1 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(true);
    assert.apply(null, args);
}

function FAIL() {
    var args = Array.prototype.slice.call(arguments);
    if (1 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(false);
    assert.apply(null, args);
}

function UNDEFINED() {
    var args = Array.prototype.slice.call(arguments);
    if (1 === args[0])  {
         args = args.slice(1);
    }
    else if (filter) return;
    args.push(undefined);
    assert.apply(null, args);
}

//Signature of PASS, FAIL and UNDEFINED:
//newDoc, oldDoc, userCtx, dbRules, list of cached objects
//insert null for any of the last 3 args and they get ignored

//set filter to true, mark the FAIL, PASS or UNDEFINED function by
//giving a 1 as its first argument and only perform the marked tests
// var filter = true;
var filter = false;

//****************************************TESTS****************************************************
var tests = [
    //test db validation rules
    function() {
        //if there are no dbrules, writing is not allowed by default
        var dbRules =  [];
        FAIL({ type:'location', id:"user" }, { }, null, dbRules, null, null);
    }, 
    
    
    function() {
        //if there's an empty dbrule ('_') then allow anything
        var dbRules =  ['_'];
        PASS( { type:'location', id:"user", crazy: 'crazy' }, { }, null, dbRules, null, null);
    }, 
    function() {
        //validate docs based on fixed value keys and type of value of a key
        var dbRules =  [
            "_type:'location'; location:'bla2'",
            "_astring:string",
            "_obj:object",
            "_array: array",
            "_number: number",
            "_type:'location', location:'bla'"
        ];
        
        PASS( { type:'location', location:'bla' }, { }, null, dbRules, null, null);
        PASS( { type:'location', location:'bla2' }, { }, null, dbRules, null, null);
        FAIL( { type:'location', location:'bla3' }, { }, null, dbRules, null, null);
        FAIL( { type:'location2', location:'bla' }, { }, null, dbRules, null, null);
        
        FAIL( { }, { }, null, dbRules, null, null);
        FAIL( { type:'noway' }, { }, null, dbRules, null, null);
        FAIL( { location:'noway' }, { }, null, dbRules, null, null);
        FAIL( { location:'noway', type:'noway' }, { }, null, dbRules, null, null);
        
        PASS( { astring:'some string' }, { }, null, dbRules, null, null);
        FAIL( { astring: 123 }, { }, null, dbRules, null, null);
        
        FAIL( { obj:'some string' }, { }, null, dbRules, null, null);
        PASS( { obj: { a: 1}}, { }, null, dbRules, null, null);
        
        FAIL( { number:'some string' }, { }, null, dbRules, null, null);
        PASS( { number: 123 }, { }, null, dbRules, null, null);
        
        PASS( { array:[1,2,3] }, { }, null, dbRules, null, null);
        FAIL( { array: 123 }, { }, null, dbRules, null, null);
    },
    //don't know if they're useful, but added nonetheless
    //test for existence and being defined of a key:
    function() {
        var dbRules =  [
            "_defined: defined"
        ];
        
        FAIL( { defined:undefined }, { }, null, dbRules, null, null);
        FAIL( { }, { }, null, dbRules, null, null);
        PASS( { defined: 123}, { }, null, dbRules, null, null);
    },
    
    function() {
        var dbRules =  [
            "_illegal: illegal"
        ];
        
        FAIL( { illegal: 123}, { }, null, dbRules, null, null);
        FAIL( { illegal: undefined}, { }, null, dbRules, null, null);
        PASS( { }, { }, null, dbRules, null, null);
    },
    
    function() {
        var dbRules =  [
            "_notdefined: notdefined"
        ];
        
        PASS( { notdefined:undefined}, { }, null, dbRules, null, null);
        PASS( { }, { }, null, dbRules, null, null);
        FAIL( { notdefined: 123 }, { }, null, dbRules, null, null);
    },
    
    //test user allow rules**********************************************
    function() {
        //only fixed values and only values with key 'id' can be updated
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_| ONLY: id"
            ]
        };
        PASS( { id:"user" }, { }, userCtx, null, null, null);
    }, 
    function() {
        //only fixed values and only values with key 'id' can be updated
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_| ONLY: id"
            ]
        };
        FAIL( { somekey:"user" }, { }, userCtx, null, null, null);
    }, 
    function() {
        //only fixed values and only values with key 'id' can be updated
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_| ONLY: id"
            ]
        };
        PASS( { somekey:"user" }, { somekey:"user" }, userCtx, null, null, null);
    }, 
    function() {
        //only fixed values and only values with key 'id' can be updated
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_| ONLY: id"
            ]
        };
        FAIL( { somekey:"user" }, { somekey:"othervalue" }, userCtx, null, null, null);
    }, 
    function() {
        //only fixed values
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_mydb_type:'location'"
            ]
        };
        PASS( { type:'location' , fieldb: 1}, { }, userCtx, null, null, null);
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
        PASS( { type:'location', id:"user", fieldb: 123 }, { }, userCtx, null, null, null);
    }, 
    function() {
        //if there are no allow rules for the user, writing is not allowed by default
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
            ]
        };
        FAIL( { type:'location', id:"user" }, { }, userCtx, null, null, null);
    }, 
    function() {
        //syntax errors:
        
        //no database in the place of the star or a star: allow_*_
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow__type:'location', id:user|  ONLY: salt, key"
            ]
        };
        UNDEFINED( { type:'location', id:"user" }, { }, userCtx, null, null, null);
        
        //colon missing after type
        userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type'location', id:user|  ONLY: salt, key"
            ]
        };
        UNDEFINED( { type:'location', id:"user" }, { }, userCtx, null, null, null);
        
        //no colon ater ONLY
        userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location1', id:user|  ONLY salt, key"
            ]
        };
        
        UNDEFINED( { type:'location1', id:"user" }, { }, userCtx, null, null, null);
    },
    function() {
        //separator of fields can be ;
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location'; id:user|  ONLY: salt key"
            ]
        };
        
        PASS( { type:'location', id:"user" , salt:1}, { }, userCtx, null, null, null);
        PASS( { type:'location', id:"user" , salt:1, key:'bla'}, { }, userCtx, null, null, null);
        PASS( { type:'location', id:"user" }, { }, userCtx, null, null, null);
        
        FAIL( { type:'location' }, { }, userCtx, null, null, null);
        FAIL( { type:'somelocation', id:"user", salt:1, key:2, somekey:1 }, { somekey:1 }, userCtx, null, null, null);
        PASS( { type:'location', id:"user", salt:1, key:2, somekey:1 }, { somekey:1 }, userCtx, null, null, null);
        FAIL( { type:'location', id:"user", salt:1, key:2, somekey:1 }, { somekey:2 }, userCtx, null, null, null);
        PASS( { type:'location', id:"user", salt:1, key:2}, { }, userCtx, null, null, null);
        FAIL( { type:'location', id:"user", salt:1, key:2, somekey:1}, { }, userCtx, null, null, null);
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
        
        PASS( { type:'location', id:"user" }, { }, userCtx, null, null, null);
        PASS( { type:'location', id:"user" , somekey:1 }, { }, userCtx, null, null, null);
        
        FAIL( { type:'location', id:"user" , salt:1}, { }, userCtx, null, null, null);
        FAIL( { type:'location', id:"user" , salt:1, key:'bla'}, { }, userCtx, null, null, null);
        FAIL( { type:'location' }, { }, userCtx, null, null, null);
        FAIL( { type:'somelocation', id:"user", salt:1, key:2, somekey:1 }, { }, userCtx, null, null, null);
    },
    function() {
        //allow any value to any database
        var userCtx = {
            name: 'user',
            db:'blabla',
            roles: [
                "allow_*_"
            ]
        };
        PASS( { id:"user" }, { }, userCtx, null, null, null);
    }, 
    function() {
        //allow only a certain database
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_mydb_"
            ]
        };
        PASS( { type:'location', id:"user" }, { }, userCtx, null, null, null);
    },
    function() {
        //allow rule doesn't apply to this mydb
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_somedb_"
            ]
        };
        FAIL( { type:'location', id:"user" }, { }, userCtx, null, null, null);
        
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
        FAIL( { type:'location', _id:"someUser"}, { }, userCtx, null, null, null);
        
    },
    function() {
        var userCtx = {
            name: 'user',
            db:'mydb',
            roles: [
                "allow_*_type:'location', _id:user| NOT: salt, key",
                "allow_*_type:'t2', _id:user| NOT:"
            ]
        };
        FAIL({ type:'location', _id:"user" ,salt:1}, { }, userCtx, null, null, null);
        PASS({ type:'t2', _id:"user" ,salt:1}, { }, userCtx, null, null, null );
        
    }
    //test caching of passed in args:
    ,function() {
        var userCtx = {
            name: 'user',
            roles: ['allow_*_']
        };
        var dbRules = [ '_' ];
        var dbRoles = [];
        PASS(  { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, null);
        PASS(  { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, 'dbRules,userCtx,dbRoles');
        
        userCtx = {
            name: 'user',
            key: 'value',
            roles: ['allow_*_']
        };
        PASS(   { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, 'dbRules,dbRoles');
        PASS(   { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, 'dbRules,userCtx,dbRoles');
        
        dbRules =  [
            "_number: number"
        ];
        PASS(  { number: 1, name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, 'userCtx,dbRoles');
        PASS(   { number: 1, name: 'user', key: 'value' }, { }, userCtx, dbRules, [], 'dbRules,userCtx,dbRoles');
        
        dbRoles =  [  "someRole" ];
        PASS(   { number: 1, name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles,'dbRules,userCtx,');
        PASS(   { number: 1, name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles,'dbRules,userCtx,dbRoles');
        
    }
    
    //allow write if the user has the role 'allow_someRole_' and
    //'someRole' is assigned to the database
    ,function() {
        var userCtx = {
            name: 'user',
            roles: ['allow_someRole_']
        };
        var dbRules = [ '_' ];
        var dbRoles = ['someRole'];
        PASS(1, { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, null);
        
        dbRoles = ['someOtherRole'];
        FAIL(1, { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, null);
        dbRoles = ['someOtherRole'];
        userCtx = {
            name: 'user',
            roles: ['allow_someOtherRole_']
        };
        PASS(1, { name: 'user', key: 'value' }, { }, userCtx, dbRules, dbRoles, null);
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
