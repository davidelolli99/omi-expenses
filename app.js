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

    try {

    // tutto il tuo codice attuale

  } catch(err) {

    console.error(err);

    alert(
      "Errore: " + err.message
    );

  }
}

    const date =
        document.getElementById("date").value;

    const amount =
        document.getElementById("amount").value;

    const category =
        document.getElementById("category").value;

    const file =
        document.getElementById("receipt").files[0];

    let receiptUrl = null;

    if (file) {

        const fileName =
            Date.now() + "_" + file.name;

        const upload =
            await supabaseClient
                .storage
                .from("receipts")
                .upload(
                    fileName,
                    file
                );

        if (upload.error) {
            alert(upload.error.message);
            return;
        }

        const publicUrl =
            supabaseClient
                .storage
                .from("receipts")
                .getPublicUrl(fileName);

        receiptUrl =
            publicUrl.data.publicUrl;
    }

    const { error } =
        await supabaseClient
            .from("expenses")
            .insert([
                {
                    expense_date: date,
                    amount: Number(amount),
                    category: category,
                    receipt_url: receiptUrl
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

        € ${expense.amount}<br><br>

        ${
          expense.receipt_url
            ? `${expense.receipt_url}📷 Scontrino</a>`
            : ""
        }

      </div>
    `;

  });
}

loadExpenses();