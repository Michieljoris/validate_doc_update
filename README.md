doc_validate_update
--------------
An automated document validator for couchdb. 

By misusing secObj and user's roles slightly it is possible with this update
function to implement simple write validation without ever writing or
modifying the doc_validate_update in the database's design
document(s);

It consists of 2 parts, the validate_doc_update.js function itself and
the commonjs module validator.js Store both functions under their own
name in a design document in your database.

Per my design a database will be locked down by default , write permissions are
then given, not taken away.

The validator parses the secObj of the database it is in, and the
userCtx of the user trying to write a document to base its ya or nay
decision on.

First of all a document has to be validated to be appropiate for the
database:

You can store under members/names strings describing what kind of docs are allowed in the
database. For instance:


	[ "_type:'comment', text:string, article:defined",
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

Fields can be validated as any type of literal, so numbers, strings,
objects, or arrays.

You can also validate the type of the field itself (object, string,
number), or require a field to be defined, undefined, or illegal.

The 'names' have to start with an underscorea to distinguish them from
real names you might want to add to the secObj.members.names. Couchdb
names cannot start with an underscore, so there will be no conflict.

A user needs write permission. This can be done by adding "write*"
roles to the database's secObj.members.roles array. The star in  "write*"
can be anything you want. Use "write" for generic permission, and
"write-databaseName" to allow writing to a specific database for instance. Any user with any of these roles assigned to
them will then have read permission for the database, and preliminary write
permission.

To allow a user to write actual documents to the database, we need to
bastardize couchdb's role system a little more again by assigning further
roles to the user's roles to describe what he is allowed to do. These
roles do not have to be added to any database. The validator parses
these roles and decides what kind of docs the user is allowed to
write. 

A user's userCtx.roles might look like this: 

    [ 
	  "allow_*_ type:'article', writer:user | ONLY text date ",
	  ,"allow_mydb_ type:'userdata  | NOT password "
	  ,"allow_*_ type:'notes'"
	]

This translates as:

    Allow this user to write to the database only when EITHER the
    doc.type equals 'article' and doc.writer equals the user's couchdb id
    and the only other modified fields are doc.text and doc.date OR
    this database's name is 'mydb' and doc.type equals 'userdata' and
    doc.password is NOT modified OR  doc.type equals 'notes'

User and database rules get parsed the first time and then 'compiled'
to validation functions. These functions get cached and do not have
to be recompiled for the next write unless a different user tries to
write to the database, or the database rules in secObj.members.names
get changed. The latter situation will be rare. The first one might
not be a rare event, and if there are performance problems it is
possible to cache a number of users, or possibly all of them (not
implemented yet).

See tests.js for exammples on how to use the validator.

	node tests.js
	
to run them.
