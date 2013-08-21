var validator = require('./validator.js');


var userCtx = {
    name: 'user',
    db:'mydb',
    roles: [
        "allow_*_type:'location', id:user | NOT: salt, key"
        
    ]
};

validator.init(null, userCtx);



