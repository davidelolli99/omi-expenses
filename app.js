const SUPABASE_URL =
  "https://yumndwfqjxkboaputyia.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_9dhDmCkwaK9a5LkRk-jCPQ_o7Dxn0bW";

const { createClient } = supabase;

const supabaseClient =
  createClient(
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
          amount: Number(amount),
          category: category
        }
      ]);

  if (error) {
    alert(error.message);
    return;
  }

  alert("Spesa salvata!");

  loadExpenses();
}

async function loadExpenses() {

  const { data, error } =
    await supabaseClient
      .from("expenses")
      .select("*")
      .order("expense_date", {
        ascending: false
      });

  if (error) {
    console.error(error);
    return;
  }

  const container =
    document.getElementById("expenses");

  container.innerHTML = "";

  data.forEach(expense => {

    container.innerHTML += `
      <div class="card">
        <b>${expense.expense_date}</b><br>
        ${expense.category}<br>
        € ${expense.amount}
      </div>
    `;
  });
}

loadExpenses();