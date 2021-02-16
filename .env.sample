module.exports.config = () => {
   return {
       HOST: "https://sampleapi.wisaw.com",

       DB_USERNAME: "root",
       DB_PASSWORD: "root",
       DB_DATABASE: "ew_sample",
       DB_HOST: "localhost",
       DB_DIALECT: "postgres",
        get DATABASE_URL() {
          return this.DB_DIALECT + "://" + this.DB_USERNAME + ":" + this.DB_PASSWORD + "@" + this.DB_HOST + ":5432/" + this.DB_DATABASE
        }
    };
}
