require("dotenv").config();
const { getDLPool } = require("./db");

async function importFileDb() {
  const pool = getDLPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");


    await client.query(`
      CREATE TABLE IF NOT EXISTS black_list (
        id SERIAL PRIMARY KEY,
        name_of_suspected VARCHAR(255),
        predicate_offence VARCHAR(255),
        phone_no VARCHAR(100)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deliquent_list (
        no SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        tin VARCHAR(100),
        reference_no VARCHAR(100)
      )
    `);


    await client.query(`
      CREATE TABLE IF NOT EXISTS eth_list (
        sn SERIAL PRIMARY KEY,
        name VARCHAR(255),
        detail TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pep_list (
        id SERIAL PRIMARY KEY,
        nameeng VARCHAR(255),
        nameamh VARCHAR(255),
        position VARCHAR(255),
        placeofassignment VARCHAR(255),
        detail TEXT
      )
    `);


    await client.query(`
      CREATE TABLE IF NOT EXISTS pep_adverser_list (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        relation VARCHAR(255),
        position VARCHAR(255)
      )
    `);
    // await client.query(`DROP TABLE IF EXISTS eu_sanctions_list;`);
    await client.query(`
 CREATE TABLE IF NOT EXISTS eu_sanctions_list (
  id SERIAL PRIMARY KEY,
    logical_id INT NOT NULL,                        
    eu_reference_number TEXT,                
    united_nation_id TEXT,
    designation_details TEXT,
    remark TEXT,                                      
    
    -- Subject type
    subject_type_code TEXT,                
    classification_code TEXT,                  
    
    -- Name details (from nameAlias)
    whole_name TEXT NOT NULL,                 
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    name_language TEXT,                     
    is_strong BOOLEAN DEFAULT TRUE,                 
    
    -- Personal details
    gender CHAR(1),                              
    title TEXT,
    function TEXT,                                  
    
    -- Citizenship
    country_iso2_code CHAR(2),                    
    country_description TEXT,              
    
    -- Birth details
    birth_date DATE,                                
    birth_year INT,
    birth_month SMALLINT,
    birth_day SMALLINT,
    birth_city TEXT,                      
    birth_region TEXT,
    birth_country_iso2_code CHAR(2),
    birth_country_description TEXT,
    circa BOOLEAN DEFAULT FALSE,
    calendar_type TEXT,                       
    
    -- Regulation info
    regulation_type TEXT,
    organisation_type TEXT,
    publication_date DATE,
    entry_into_force_date DATE,
    number_title TEXT,                        
    programme TEXT,                            
    publication_url TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);



    await client.query(`
      CREATE TABLE IF NOT EXISTS ofac_sanctions_list (
        id SERIAL PRIMARY KEY,
        ofac_id VARCHAR(50) UNIQUE NOT NULL,
        identity_id VARCHAR(50),
        
        -- Entity Classification
        entity_type VARCHAR(50),
        
        -- Names
        primary_name TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        
        -- Core Identifiers
        aliases TEXT,
        dob TEXT,
        pob TEXT,
        citizenship TEXT,
        
        -- Additional Details
        addresses TEXT,
        features TEXT,
        
        -- Sanctions Info
        sanctions_lists TEXT,
        sanctions_programs TEXT,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS un_sanctions_list (
        id SERIAL PRIMARY KEY,
        dataid VARCHAR(50) UNIQUE NOT NULL,
        versionnum VARCHAR(10),
        first_name TEXT,
        second_name TEXT,
        third_name TEXT,
        un_list_type TEXT,
        reference_number TEXT,
        listed_on TEXT,
        gender TEXT,
        comments1 TEXT,
        designation TEXT,
        nationality TEXT,
        list_type TEXT,
        last_day_updated TEXT,
        aliases TEXT,
        addresses TEXT,
        dob TEXT,
        pob TEXT,
        documents TEXT,
        has_interpol_link TEXT,
        interpol_link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS un_designated_list (
        id SERIAL PRIMARY KEY,
        dataid VARCHAR(50) UNIQUE NOT NULL,
        versionnum VARCHAR(10),
        first_name TEXT,
        second_name TEXT,
        third_name TEXT,
        un_list_type TEXT,
        reference_number TEXT,
        listed_on TEXT,
        gender TEXT,
        comments1 TEXT,
        designation TEXT,
        nationality TEXT,
        list_type TEXT,
        last_day_updated TEXT,
        aliases TEXT,
        addresses TEXT,
        dob TEXT,
        pob TEXT,
        documents TEXT,
        has_interpol_link TEXT,
        interpol_link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query("COMMIT");
    console.log(" Import DB files tables created successfully");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create Import DB tables:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = importFileDb;
