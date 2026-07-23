/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('house_mappings', function(table) {
    table.double('latitude').nullable();
    table.double('longitude').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('house_mappings', function(table) {
    table.dropColumn('latitude');
    table.dropColumn('longitude');
  });
};

