// ======================================================
// CONFIGURAZIONE SUPABASE
// ======================================================

const SUPABASE_URL =
    "https://yumndwfqjxkboaputyia.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_9dhDmCkwaK9a5LkRk-jCPQ_o7Dxn0bW";


if (!window.supabase) {
    throw new Error(
        "Supabase non è stato caricato correttamente."
    );
}


const { createClient } = window.supabase;


const supabaseClient =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ======================================================
// CONFIGURAZIONE
// ======================================================

const RECEIPTS_BUCKET = "receipts";

const MAX_RECEIPT_SIZE =
    6 * 1024 * 1024;


// ======================================================
// SALVA SPESA
// ======================================================

async function saveExpense() {

    const saveButton =
        document.getElementById("saveButton");

    try {

        saveButton.disabled = true;

        saveButton.textContent =
            "Salvataggio...";


        // ----------------------------------------------
        // RECUPERO CAMPI
        // ----------------------------------------------

        const date =
            document
                .getElementById("date")
                .value;


        const amountValue =
            document
                .getElementById("amount")
                .value;


        const category =
            document
                .getElementById("category")
                .value;
          if (!category) {

    alert(
        "Non sono riuscito a riconoscere automaticamente " +
        "la categoria dello scontrino.\n\n" +
        "Riprova a leggere lo scontrino."
    );

    return;
}


        const fileInput =
            document
                .getElementById("receipt");


        const file =
            fileInput.files[0] || null;


        // ----------------------------------------------
        // VALIDAZIONE DATA
        // ----------------------------------------------

        if (!date) {

            alert(
                "Inserisci la data."
            );

            return;
        }


        // ----------------------------------------------
        // VALIDAZIONE IMPORTO
        // ----------------------------------------------

        const amount =
            Number(amountValue);


        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {

            alert(
                "Inserisci un importo valido."
            );

            return;
        }


        // ----------------------------------------------
        // VALIDAZIONE FILE
        // ----------------------------------------------

        if (file) {

            if (
                !file.type.startsWith("image/")
            ) {

                alert(
                    "Lo scontrino deve essere un'immagine."
                );

                return;
            }


            if (
                file.size > MAX_RECEIPT_SIZE
            ) {

                alert(
                    "L'immagine è troppo grande. " +
                    "Il limite è 6 MB."
                );

                return;
            }
        }


        // ----------------------------------------------
        // UPLOAD SCONTRINO
        // ----------------------------------------------

        let receiptPath = null;


        if (file) {

            receiptPath =
                createReceiptPath(file);


            const {
                error: uploadError
            } =
                await supabaseClient
                    .storage
                    .from(RECEIPTS_BUCKET)
                    .upload(
                        receiptPath,
                        file,
                        {
                            cacheControl: "3600",
                            upsert: false,
                            contentType:
                                file.type ||
                                "image/jpeg"
                        }
                    );


            if (uploadError) {

                console.error(
                    "Errore Storage:",
                    uploadError
                );

                alert(
                    "Errore durante il caricamento " +
                    "dello scontrino:\n" +
                    uploadError.message
                );

                return;
            }
        }


        // ----------------------------------------------
        // SALVATAGGIO DATABASE
        // ----------------------------------------------

        const {
            error: insertError
        } =
            await supabaseClient
                .from("expenses")
                .insert([
                    {
                        expense_date: date,
                        amount: amount,
                        category: category,

                        // Manteniamo il nome del campo
                        // già esistente nel database.
                        // Nei nuovi record memorizziamo
                        // il percorso Storage.
                        receipt_url: receiptPath
                    }
                ]);


        if (insertError) {

            console.error(
                "Errore database:",
                insertError
            );


            // Se il database fallisce,
            // proviamo a cancellare il file appena caricato.
            if (receiptPath) {

                try {

                    await supabaseClient
                        .storage
                        .from(RECEIPTS_BUCKET)
                        .remove([
                            receiptPath
                        ]);

                } catch (
                    cleanupError
                ) {

                    console.error(
                        "Errore pulizia file:",
                        cleanupError
                    );
                }
            }


            alert(
                "Errore durante il salvataggio:\n" +
                insertError.message
            );

            return;
        }


        // ----------------------------------------------
        // SUCCESSO
        // ----------------------------------------------

        alert(
            "Spesa salvata correttamente!"
        );


        document
            .getElementById("amount")
            .value = "";


        document
            .getElementById("receipt")
            .value = "";


        if (
            typeof resetOcrUi ===
            "function"
        ) {

            resetOcrUi();
        }


        await loadExpenses();

    }

    catch (error) {

        console.error(
            "Errore JavaScript:",
            error
        );

        alert(
            "Errore JavaScript:\n" +
            error.message
        );

    }

    finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "💾 Salva spesa";
    }
}


// ======================================================
// CREA NOME SICURO PER LO SCONTRINO
// ======================================================

function createReceiptPath(file) {

    let extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            );


    if (
        !extension ||
        extension.length > 5
    ) {

        extension = "jpg";
    }


    let uniqueId;


    if (
        window.crypto &&
        typeof crypto.randomUUID ===
            "function"
    ) {

        uniqueId =
            crypto.randomUUID();

    } else {

        uniqueId =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2);
    }


    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}/${month}/` +
        `${uniqueId}.${extension}`
    );
}


// ======================================================
// CARICA STORICO
// ======================================================

async function loadExpenses() {

    const container =
        document.getElementById(
            "expenses"
        );


    container.textContent =
        "Caricamento spese...";


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("expenses")
                .select("*")
                .order(
                    "expense_date",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                error
            );

            container.textContent =
                "Errore nel caricamento delle spese.";

            return;
        }


        container.textContent = "";


        if (
            !data ||
            data.length === 0
        ) {

            container.textContent =
                "Nessuna spesa salvata.";

            return;
        }


        for (
            const expense of data
        ) {

            const card =
                await createExpenseCard(
                    expense
                );


            container.appendChild(
                card
            );
        }

    }

    catch (error) {

        console.error(
            error
        );


        container.textContent =
            "Errore durante il caricamento dello storico.";
    }
}


// ======================================================
// CREA CARD SPESA
// ======================================================

async function createExpenseCard(
    expense
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "card";


    // DATA
    const dateElement =
        document.createElement(
            "strong"
        );


    dateElement.textContent =
        formatItalianDate(
            expense.expense_date
        );


    card.appendChild(
        dateElement
    );


    card.appendChild(
        document.createElement(
            "br"
        )
    );


    // CATEGORIA
    const categoryElement =
        document.createElement(
            "span"
        );


    categoryElement.textContent =
        expense.category || "";


    card.appendChild(
        categoryElement
    );


    card.appendChild(
        document.createElement(
            "br"
        )
    );


    // IMPORTO
    const amountElement =
        document.createElement(
            "span"
        );


    amountElement.textContent =
        formatCurrency(
            expense.amount
        );


    card.appendChild(
        amountElement
    );


    // SCONTRINO
    if (
        expense.receipt_url
    ) {

        const receiptUrl =
            await resolveReceiptUrl(
                expense.receipt_url
            );


        if (receiptUrl) {

            card.appendChild(
                document.createElement(
                    "br"
                )
            );

            card.appendChild(
                document.createElement(
                    "br"
                )
            );


            const image =
                document.createElement(
                    "img"
                );


            image.src =
                receiptUrl;

            image.alt =
                "Scontrino";

            image.loading =
                "lazy";

            image.style.width =
                "100%";

            image.style.maxWidth =
                "250px";

            image.style.borderRadius =
                "8px";

            image.style.border =
                "1px solid #ddd";


            card.appendChild(
                image
            );


            card.appendChild(
                document.createElement(
                    "br"
                )
            );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                receiptUrl;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            link.textContent =
                "📷 Apri scontrino";


            card.appendChild(
                link
            );
        }
    }


    return card;
}


// ======================================================
// OTTIENE URL DELLO SCONTRINO
// ======================================================

async function resolveReceiptUrl(
    storedValue
) {

    // Compatibilità con i vecchi record,
    // che contengono già l'URL completo.

    if (
        /^https?:\/\//i.test(
            storedValue
        )
    ) {

        return storedValue;
    }


    // Prima proviamo con URL firmato.
    // Utile se il bucket è privato.

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .storage
                .from(RECEIPTS_BUCKET)
                .createSignedUrl(
                    storedValue,
                    3600
                );


        if (
            !error &&
            data?.signedUrl
        ) {

            return data.signedUrl;
        }

    }

    catch (error) {

        console.warn(
            "Signed URL non disponibile:",
            error
        );
    }


    // Fallback:
    // se il bucket è ancora pubblico.

    const {
        data
    } =
        supabaseClient
            .storage
            .from(RECEIPTS_BUCKET)
            .getPublicUrl(
                storedValue
            );


    return (
        data?.publicUrl ||
        null
    );
}


// ======================================================
// FORMATTA IMPORTO
// ======================================================

function formatCurrency(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(number)
    ) {

        return "0,00 €";
    }


    return number.toLocaleString(
        "it-IT",
        {
            style: "currency",
            currency: "EUR"
        }
    );
}


// ======================================================
// FORMATTA DATA
// ======================================================

function formatItalianDate(
    date
) {

    if (!date) {
        return "";
    }


    const parts =
        date.split("-");


    if (
        parts.length !== 3
    ) {

        return date;
    }


    return (
        `${parts[2]}/` +
        `${parts[1]}/` +
        `${parts[0]}`
    );
}


// ======================================================
// DATA ODIERNA LOCALE
// ======================================================

function setToday() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    document
        .getElementById("date")
        .value =
        `${year}-${month}-${day}`;
}


// ======================================================
// AVVIO APP
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setToday();

        await loadExpenses();
    }
);