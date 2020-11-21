# Installation

## HAPI FHIR Server Installation
Install Postgres server 10 or higher
```bash
sudo apt install postgresql-10
```

Follow instructions in <a href="https://www.digitalocean.com/community/tutorials/install-tomcat-9-ubuntu-1804">here</a> to install tomcat 9. You may need to look for other tomcat installation directions if you are not using ubuntu 18.04

Create postgres user and database for hapi
```bash
sudo -u postgres psql
```
```bash
postgres=# create database hapi;
```
```bash
postgres=# create user hapi with encrypted password 'hapi';
```
```bash
postgres=# grant all privileges on database hapi to hapi;
```

Install Maven
```bash
sudo apt install maven
```

Clone HAPI FHIR
```bash
git clone https://github.com/hapifhir/hapi-fhir-jpaserver-starter.git
```
```bash
cd hapi-fhir-jpaserver-starter
```

Open and edit pom.xml to change finalName to hapi
```bash
vim pom.xml
```
```bash
<build>

        <!-- Tells Maven to name the generated WAR file as hapi.war -->
        <finalName>hapi</finalName>
```

Open and edit src/main/resources/application.yaml as below
```bash
vim src/main/resources/application.yaml
```
```bash
---
hapi:
  fhir:
    defer_indexing_for_codesystems_of_size: 101
    partitioning:
      cross_partition_reference_mode: true
      multitenancy_enabled: true
      partitioning_include_in_search_hashes: true
    enforce_referential_integrity_on_write: false
    tester:
      -
        fhir_version: R4
        id: home
        name: "Local Tester"
        refuse_to_fetch_third_party_urls: false
        server_address: "http://localhost:8081/hapi/fhir"
      -
        fhir_version: R4
        id: global
        name: "Global Tester"
        refuse_to_fetch_third_party_urls: false
        server_address: "http://hapi.fhir.org/baseR4"
spring:
  batch:
    job:
      enabled: false
  datasource:
    driverClassName: org.postgresql.Driver
    max-active: 15
    password: hapi
    url: "jdbc:postgresql://localhost:5432/hapi"
    username: hapi
  jpa:
    properties:
      hibernate.cache.use_minimal_puts: false
      hibernate.cache.use_query_cache: false
      hibernate.cache.use_second_level_cache: false
      hibernate.cache.use_structured_entries: false
      hibernate.dialect: org.hibernate.dialect.PostgreSQL95Dialect
      hibernate.format_sql: false
      hibernate.hbm2ddl.auto: update
      hibernate.jdbc.batch_size: 20
      hibernate.search.default.directory_provider: filesystem
      hibernate.search.default.indexBase: /opt/tomcat/webapps/hapi/target/lucenefiles
      hibernate.search.lucene_version: LUCENE_CURRENT
      hibernate.search.model_mapping: ca.uhn.fhir.jpa.search.LuceneSearchMappingFactory
      hibernate.show_sql: false
  profiles:
    active: r4
```

Create .war file
```bash
mvn clean install -DskipTests
```

Copy the .war to the tomcat webapps directory
```bash
sudo cp target/hapi.war /opt/tomcat/webapps
```


### Install Mongo Database
```bash
sudo apt-get install mongodb
```



Clone administrative area repository

```bash
git clone https://github.com/ashaban/gofr-tz.git
```

Enter the server directory and install node packages.

```bash
cd gofr-tz/facility-recon-backend && npm install
```

## Configuration
App configuration file is located under facility-recon-backend/config/default.json

## Start server

```js
cd lib && node index.js
```
