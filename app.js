let expenses = [];

function saveExpense() {

    const date =
        document.getElementById("date").value;

    const amount =
        document.getElementById("amount").value;

    const category =
        document.getElementById("category").value;

    expenses.push({
        date,
        amount,
        category
    });

    render();
}

function render() {

    const container =
        document.getElementById("expenses");

    container.innerHTML = "";

    expenses.forEach(expense => {

        container.innerHTML += `
            <div class="card">
                <b>${expense.date}</b><br>
                ${expense.category}<br>
                € ${expense.amount}
            </div>
        `;
    });
}