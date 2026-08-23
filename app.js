alert("VERSIONE 23-08-2026 ORE 16:00");
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

    const date =
      document.getElementById("date").value;

    const amount =
      document.getElementById("amount").value;

    const category =
      document.getElementById("category").value;

    const fileInput =
      document.getElementById("receipt");

    const file =
      fileInput.files[0];

    if (!date) {
      alert("Inserisci la data");
      return;
    }

    if (!amount) {
      alert("Inserisci l'importo");
      return;
    }

    let receiptUrl = null;

    if (file) {

      const fileName =
        `${Date.now()}_${file.name}`;

      const uploadResult =
        await supabaseClient
          .storage
          .from("receipts")
          .upload(
            fileName,
            file,
            {
              upsert: true
            }
          );

      if (uploadResult.error) {

        alert(
          "Errore upload: " +
          uploadResult.error.message
        );

        return;
      }

      const publicUrlResult =
        supabaseClient
          .storage
          .from("receipts")
          .getPublicUrl(fileName);

      receiptUrl =
        publicUrlResult.data.publicUrl;
    }

    const insertResult =
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

    if (insertResult.error) {

      alert(
        "Errore database: " +
        insertResult.error.message
      );

      return;
    }

    alert("Spesa salvata!");

    document.getElementById("amount").value = "";
    document.getElementById("receipt").value = "";

    loadExpenses();

  } catch (error) {

    console.error(error);

    alert(
      "Errore JavaScript: " +
      error.message
    );
  }
}

async function loadExpenses() {

  try {

    const result =
      await supabaseClient
        .from("expenses")
        .select("*")
        .order(
          "expense_date",
          {
            ascending: false
          }
        );

    if (result.error) {
      console.error(result.error);
      return;
    }

    const container =
      document.getElementById("expenses");

    container.innerHTML = "";

    result.data.forEach(expense => {

      let receiptHtml = "";

      if (expense.receipt_url) {

        receiptHtml = `
          <br><br>

          ${expense.receipt_url}

          <br><br>

          ${expense.receipt_url}
            📷 Apri scontrino
          </a>
        `;
      }

      container.innerHTML += `
        <div class="card">

          <b>${expense.expense_date}</b>

          <br>

          ${expense.category}

          <br>

          € ${expense.amount}

          ${receiptHtml}

        </div>
      `;
    });

  } catch (error) {

    console.error(error);

    alert(
      "Errore caricamento storico: " +
      error.message
    );
  }
}

loadExpenses();

document.getElementById("date").value =
  new Date().toISOString().split("T")[0];