const SUPABASE_URL =
  "https://yumndwfqjxkboaputyia.supabase.co";

const SUPABASE_KEY =
  "LA_TUA_PUBLISHABLE_KEY";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

async function saveExpense() {

    try {

        const result =
            await supabaseClient
                .from("expenses")
                .select("*");

        console.log(result);

        alert("Test completato");

    } catch(err) {

        alert(err.message);

    }
}