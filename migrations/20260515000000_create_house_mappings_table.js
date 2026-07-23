/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('house_mappings', function(table) {
    table.increments('id').primary();
    table.string('sheet_house_name').notNullable();
    table.string('sheet_city_name').notNullable();
    table.json('db_house_ids').nullable(); // JSON array of house IDs from the main DB
    table.boolean('is_ignored').defaultTo(false);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('house_mappings');
};
