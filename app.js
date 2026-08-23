const SUPABASE_URL =
  "https://yumndwfqjxkboaputyia.supabase.co";

const SUPABASE_KEY =
  "LA_TUA_PUBLISHABLE_KEY";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

function saveExpense() {
    alert("Entrato nella funzione");
    console.log("Supabase:", supabaseClient);
}