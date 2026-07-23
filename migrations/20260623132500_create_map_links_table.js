exports.up = function(knex) {
  return knex.schema.createTable('map_links', table => {
    table.string('id').primary();
    table.text('sectors_data').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('map_links');
};
