const SUPABASE_URL =
  "https://yumndwfqjxkboaputyia.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_9dhDmCkwaK9a5LkRk-jCPQ_o7Dxn0bW";

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

  if (!date || !amount) {
    alert("Inserire data e importo");
    return;
  }

  try {

    const { error } =
      await supabaseClient
        .from("expenses")
        .insert([
          {
            expense_date: date,
            amount: Number(amount),
            category: category
          }
        ]);

    if (error) {
      alert("Errore: " + error.message);
      return;
    }

    alert("Spesa salvata!");

  } catch (err) {

    alert("Errore: " + err.message);

  }
}