function saveExpense() {

    const date =
        document.getElementById("date").value;

    const amount =
        document.getElementById("amount").value;

    const category =
        document.getElementById("category").value;

    alert(
        "Data: " + date +
        "\nImporto: " + amount +
        "\nCategoria: " + category
    );
}