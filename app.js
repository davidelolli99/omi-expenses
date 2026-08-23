alert("app.js caricato");
const SUPABASE_URL = "https://yumndwfqjxkboaputyia.supabase.co";
sb_publishable_9dhDmCkwaK9a5LkRk-jCPQ_o7Dxn0bW

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

async function saveExpense() {

  const date =
    document.getElementById("date").value;

  const amount =
    document.getElementById("amount").value;

  const category =
    document.getElementById("category").value;

  const { error } =
    await supabaseClient
      .from("expenses")
      .insert([
        {
          expense_date: date,
          amount: amount,
          category: category
        }
      ]);

  if(error){
    alert("Errore: " + error.message);
    return;
  }

  alert("Spesa salvata!");
}
``