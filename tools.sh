# Migrate data
npx prisma@6 db execute \
  --file ../data/seed.sql \
  --schema schema.prisma

# Migrate schema
npx prisma@6 migrate deploy
