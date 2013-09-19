validate_doc_update
--------------
An automated document validator for couchdb. 

By misusing secObj and user's roles slightly it is possible with this update
function to implement simple write validation without ever writing or
modifying the doc_validate_update in the database's design
document(s);

It consists of 2 parts, the validate_doc_update.js function itself and
the commonjs module validator.js. Store the first under its own name,
and the second one under lib. So your design document should look like
this:

	{ validate_doc_update: [contents of validate_doc_update.js],
	  lib: {
	           validator: [contents of validator.js]
		   }
	  }

Per my design a database will be locked down by default , write permissions are
then given, not taken away.

The validator parses the secObj of the database it is in, and the
userCtx of the user trying to write a document to base its yea or nay
decision on.

First of all a document has to be validated to be appropiate for the
database:

You can store under members.names strings describing what kind of docs are allowed in the
database. For instance:


	[ "_type:'comment'; text:string, article:defined",
	  "_type:'article', writer:'Peter', count: number", article:illegal
	]
	
This translates as: 

    for every doc stored in this database, EITHER the type field has to equal
    the string 'comment', and the text field has to be of type string,
    and the field article has to be defined
    OR
	the type of the article field has to be 'article', and the writer
    field 'Peter', and the count field has to be of type number, and
    it can not have a field named article

By the way, the separator of fields can be a semicolon;

Fields can be validated as any type of literal, so numbers, strings,
objects, or arrays.

You can also validate the type of the field itself (object, string,
number), or require a field to be defined, undefined, or illegal.

The 'names' have to start with an underscore to distinguish them from
real names you might want to add to the secObj.members.names. Couchdb
names cannot start with an underscore, so there will be no conflict.

A single underscore ('_') added as to secObj.members.names will
validate any document to be written.

A user needs write permission. This can be done by adding "write*"
roles to the database's secObj.members.roles array. The star in
"write*" can be anything you want. Use "write" for generic permission,
and "write-databaseName" to allow writing to a specific database for
instance. Any user with any of these roles assigned to them will then
have read permission for the database, and preliminary write
permission.

To allow a user to write actual documents to the database, we need to
bastardize couchdb's role system a little more again by assigning further
roles to the user's roles to describe what he is allowed to do. These
roles do not have to be added to any database. The validator parses
these roles and decides what kind of docs the user is allowed to
write. 

A user's userCtx.roles might look like this: 

    [ "write",
	  "allow_*_ type:'article', writer:user | ONLY text date ",
	  ,"allow_mydb_ type:'userdata  | NOT password "
	  ,"allow_someRole_ type:'notes'"
	]

This translates as:

    Allow this user to write to the database only when EITHER the
    doc.type equals 'article' and doc.writer equals the user's couchdb id
    and the only other modified fields are doc.text and doc.date OR
    this database's name is 'mydb' and doc.type equals 'userdata' and
    doc.password is NOT modified OR  doc.type equals 'notes' and the
    database has the role 'someRole' added to secObj.members.roles
	
Use the role 'allow_*_' to allow any document to be written to any
database (assuming the user has write permission).

To unlock a database completely for a particular user:

    secObj.members.names: [ "_" ]
	secObj.members.roles: [ "write" ]
    userCtx.roles: [ "write", "allow_*_" ]
	
Write permissions have to be granted twice, once in some kind of write
role and the second time in the allow roles. Technically you could
have all the write permissions possible described using allow roles,
however the write roles make it possible to make a database unwritable
by simply removing them from the database. Same goes for any user, take
their write roles away to stop them from writing to any database. You
can then leave the (possibly complex) allow roles in place.

The parser is a bit simple, and hacked together using a little state
machine. You could write a much more capable parser that allows for
intricate and complex document writing validation, however this suited
my needs so I left it simple.

User and database rules get parsed the first time and then 'compiled'
to validation functions. These functions get cached and do not have to
be recompiled for the next write unless a different user tries to
write to the database, or the database rules and/or roles in
secObj.members get changed. The latter situation will be rare. The
first one might not be a rare event, and if there are performance
problems it is possible to cache a number of users, or possibly all of
them (not implemented yet).

See tests.js for examples on how to use the validator and execute

	node tests.js
	
to run the tests.	
