async function readReceipt() {

    const file =
        document.getElementById(
            "receipt"
        ).files[0];

    if (!file) {

        alert(
            "Seleziona prima uno scontrino"
        );

        return;
    }

    try {

        alert(
            "OCR in esecuzione..."
        );

        const result =
            await Tesseract.recognize(
                file,
                "ita+eng"
            );

        const text =
            result.data.text;

        console.log(text);

        extractData(text);

        alert(
            "OCR completato"
        );

    } catch(error) {

        console.error(error);

        alert(
            "Errore OCR: " +
            error.message
        );
    }
}

function extractData(text) {

    extractAmount(text);

    extractDate(text);

    suggestCategory(text);

}

function extractAmount(text) {

    const matches =
        text.match(
            /\d+[.,]\d{2}/g
        );

    if (!matches) {
        return;
    }

    const values =
        matches.map(item =>
            parseFloat(
                item.replace(",", ".")
            )
        );

    const maxValue =
        Math.max(...values);

    document.getElementById(
        "amount"
    ).value = maxValue;
}

function extractDate(text) {

    const patterns = [

        /(\d{2})\/(\d{2})\/(\d{4})/,

        /(\d{2})-(\d{2})-(\d{4})/

    ];

    for(const regex of patterns) {

        const match =
            text.match(regex);

        if(match) {

            const date =
                `${match[3]}-${match[2]}-${match[1]}`;

            document.getElementById(
                "date"
            ).value = date;

            return;
        }
    }
}

function suggestCategory(text) {

    const receipt =
        text.toLowerCase();

    const category =
        document.getElementById(
            "category"
        );

    if(
        receipt.includes("hotel")
        ||
        receipt.includes("booking")
    ) {
        category.value = "HOTEL";
        return;
    }

    if(
        receipt.includes("autogrill")
        ||
        receipt.includes("ristorante")
        ||
        receipt.includes("restaurant")
    ) {
        category.value = "LUNCH";
        return;
    }

    if(
        receipt.includes("eni")
        ||
        receipt.includes("q8")
        ||
        receipt.includes("shell")
        ||
        receipt.includes("ip")
    ) {
        category.value = "GASOLINE";
        return;
    }

    if(
        receipt.includes("parcheggio")
        ||
        receipt.includes("parking")
    ) {
        category.value = "PARKING";
    }
}