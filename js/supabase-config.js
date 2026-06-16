const SUPABASE_URL = "https://npewnmpxexiqeoqberkm.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZXdubXB4ZXhpcWVvcWJlcmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDg3OTIsImV4cCI6MjA5NjkyNDc5Mn0.rTavMzcN2i_z-09_RdY_CSt79XEoBgVQBpnr3biCSmk";

const { createClient } = supabase;

const db = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("Supabase Connected");