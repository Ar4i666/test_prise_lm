/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tracking_links', function(table) {
    table.string('id').primary();
    table.string('nextcloud_url').notNullable();
    table.string('client_id').nullable();
    table.datetime('opened_at').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tracking_links');
};
