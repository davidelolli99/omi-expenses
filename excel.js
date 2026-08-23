// ======================================================
// OMI EXPENSES - GENERATORE EXCEL MENSILE
// ======================================================
// Richiede JSZip (caricato da index.html), app.js e Supabase.
// Il file OMI_Expenses_TEMPLATE_CLEAN.xlsx deve trovarsi
// nella stessa cartella dell'app.

const EXCEL_TEMPLATE_URL = "OMI_Expenses_TEMPLATE_CLEAN.xlsx";

const EXPENSE_DATE_ROWS = [5, 30, 55, 80, 105, 131];
const EXCEL_COLUMNS_BY_WEEKDAY = ["B", "C", "D", "E", "F", "G", "H"];

// Offset della categoria rispetto alla riga delle date del blocco settimanale.
const EXPENSE_CATEGORY_ROW_OFFSET = {
    HOTEL: 1,
    BREAKFAST: 2,
    LUNCH: 3,
    DINNER: 4,
    TAXI: 5,
    "TAXI / TRAVELS": 5,
    GASOLINE: 6,
    "HIGHWAY TOLL": 7,
    "KM PAYBACK": 8,
    PARKING: 9,
    BAR: 10,
    LAUNDRY: 11,
    "EXTRA ON MOBILE PHONE": 12,
    OTHERS: 13,
    "EXPENSE W/O TICKET": 15,
    "PERSONAL EXPENSE": 16
};

const OMI_BLUE = "FF0070C0";
const OMI_GREEN = "FF00B050";

const ITALIAN_MONTHS = [
    "Gennaio", "Febbraio", "Marzo", "Aprile",
    "Maggio", "Giugno", "Luglio", "Agosto",
    "Settembre", "Ottobre", "Novembre", "Dicembre"
];

// ======================================================
// AVVIO / UI
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    const monthInput = document.getElementById("excelMonth");

    if (monthInput && !monthInput.value) {
        const now = new Date();

        monthInput.value =
            `${now.getFullYear()}-${String(
                now.getMonth() + 1
            ).padStart(2, "0")}`;
    }
});


function setExcelStatus(message, isError = false) {

    const element =
        document.getElementById("excelStatus");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.dataset.state =
        isError
            ? "error"
            : "normal";
}


// ======================================================
// GENERA EXCEL
// ======================================================

async function generateMonthlyExcel() {

    const button =
        document.getElementById("excelButton");

    const monthInput =
        document.getElementById("excelMonth");


    if (
        !monthInput ||
        !monthInput.value
    ) {

        alert(
            "Seleziona il mese da esportare."
        );

        return;
    }


    if (
        typeof JSZip === "undefined"
    ) {

        alert(
            "JSZip non è stato caricato correttamente."
        );

        return;
    }


    const [
        yearText,
        monthText
    ] =
        monthInput.value.split("-");


    const year =
        Number(yearText);


    const month =
        Number(monthText);


    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {

        alert(
            "Mese non valido."
        );

        return;
    }


    try {

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Generazione Excel...";
        }


        setExcelStatus(
            "Caricamento spese del mese..."
        );


        const expenses =
            await loadExpensesForMonth(
                year,
                month
            );


        setExcelStatus(
            `Trovate ${expenses.length} spese. Caricamento template...`
        );


        // ==================================================
        // CARICA TEMPLATE
        // ==================================================

        const templateResponse =
            await fetch(
                EXCEL_TEMPLATE_URL,
                {
                    cache: "no-store"
                }
            );


        if (
            !templateResponse.ok
        ) {

            throw new Error(
                `Template Excel non trovato (${templateResponse.status}). ` +
                `Controlla che ${EXCEL_TEMPLATE_URL} sia nella stessa cartella dell'app.`
            );
        }


        const templateBuffer =
            await templateResponse.arrayBuffer();


        const zip =
            await JSZip.loadAsync(
                templateBuffer
            );


        setExcelStatus(
            "Preparazione del report..."
        );


        // ==================================================
        // INDIVIDUA FOGLI EXCEL
        // ==================================================

        const timingPath =
            await getWorksheetPath(
                zip,
                "TIMING"
            );


        const expensePath =
            await getWorksheetPath(
                zip,
                "EXPENSE"
            );


        const picturesPath =
            await getWorksheetPath(
                zip,
                "Pictures"
            );


        if (
            !timingPath ||
            !expensePath ||
            !picturesPath
        ) {

            throw new Error(
                "Il template non contiene i fogli TIMING, EXPENSE e Pictures attesi."
            );
        }


        // ==================================================
        // LETTURA XML
        // ==================================================

        const timingDoc =
            parseXml(
                await zip
                    .file(timingPath)
                    .async("text"),
                timingPath
            );


        const expenseDoc =
            parseXml(
                await zip
                    .file(expensePath)
                    .async("text"),
                expensePath
            );


        const picturesDoc =
            parseXml(
                await zip
                    .file(picturesPath)
                    .async("text"),
                picturesPath
            );


        const stylesDoc =
            parseXml(
                await zip
                    .file("xl/styles.xml")
                    .async("text"),
                "xl/styles.xml"
            );


        // ==================================================
        // MESE / ANNO REPORT
        // ==================================================

        setNumericCell(
            timingDoc,
            "B1",
            year
        );


        setInlineStringCell(
            timingDoc,
            "D1",
            ITALIAN_MONTHS[
                month - 1
            ]
        );


        // ==================================================
        // PULIZIA CELLE SPESE
        // ==================================================

        clearExpenseInputCells(
            expenseDoc
        );


        // ==================================================
        // AGGREGA SPESE
        // ==================================================

        const aggregated =
            aggregateExpensesByTargetCell(
                expenses,
                year,
                month
            );


        const skippedCategories =
            new Set();


        for (
            const item of
            aggregated.values()
        ) {

            if (
                !item.cellRef
            ) {

                if (
                    item.category
                ) {

                    skippedCategories.add(
                        item.category
                    );
                }

                continue;
            }


            const cell =
                getOrCreateCell(
                    expenseDoc,
                    item.cellRef
                );


            const baseStyleId =
                Number(
                    cell.getAttribute("s") ||
                    0
                );


            const targetColor =
                item.category ===
                "GASOLINE"
                    ? OMI_GREEN
                    : OMI_BLUE;


            const coloredStyleId =
                ensureColoredStyle(
                    stylesDoc,
                    baseStyleId,
                    targetColor
                );


            setNumericCell(
                expenseDoc,
                item.cellRef,
                item.amount,
                coloredStyleId
            );
        }


        // ==================================================
        // RISCRIVE XML NEL FILE
        // ==================================================

        zip.file(
            timingPath,
            serializeXml(
                timingDoc
            )
        );


        zip.file(
            expensePath,
            serializeXml(
                expenseDoc
            )
        );


        zip.file(
            "xl/styles.xml",
            serializeXml(
                stylesDoc
            )
        );


        // ==================================================
        // SCONTRINI
        // ==================================================

        setExcelStatus(
            "Inserimento scontrini nel foglio Pictures..."
        );


        const receiptResult =
            await rebuildPicturesSheet(
                zip,
                picturesDoc,
                picturesPath,
                expenses
            );


        zip.file(
            picturesPath,
            serializeXml(
                picturesDoc
            )
        );


        // ==================================================
        // FORZA RICALCOLO EXCEL
        // ==================================================

        await forceFullCalculation(
            zip
        );


        // ==================================================
        // GENERA FILE
        // ==================================================

        setExcelStatus(
            "Creazione del file Excel..."
        );


        const outputBlob =
            await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 6
                }
            });


        const monthName =
            ITALIAN_MONTHS[
                month - 1
            ];


        const fileName =
            `OMI_Expenses_${monthName}_${year}.xlsx`;


        downloadBlob(
            outputBlob,
            fileName
        );


        let message =
            `Excel generato: ${expenses.length} spese, ` +
            `${receiptResult.inserted} scontrini inseriti.`;


        if (
            receiptResult.skipped >
            0
        ) {

            message +=
                ` ${receiptResult.skipped} scontrini non inseriti.`;
        }


        if (
            skippedCategories.size >
            0
        ) {

            message +=
                ` Categorie non mappate: ${Array.from(
                    skippedCategories
                ).join(", ")}.`;
        }


        setExcelStatus(
            message
        );

    }

    catch (error) {

        console.error(
            "Errore generazione Excel:",
            error
        );


        setExcelStatus(
            `Errore: ${error.message}`,
            true
        );


        alert(
            "Errore durante la generazione dell'Excel:\n" +
            error.message
        );
    }

    finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "📊 Genera Excel del mese";
        }
    }
}


// ======================================================
// SUPABASE
// ======================================================

async function loadExpensesForMonth(
    year,
    month
) {

    const start =
        `${year}-${String(
            month
        ).padStart(2, "0")}-01`;


    const nextMonthDate =
        new Date(
            year,
            month,
            1
        );


    const nextYear =
        nextMonthDate.getFullYear();


    const nextMonth =
        nextMonthDate.getMonth() +
        1;


    const endExclusive =
        `${nextYear}-${String(
            nextMonth
        ).padStart(2, "0")}-01`;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("expenses")
            .select("*")
            .gte(
                "expense_date",
                start
            )
            .lt(
                "expense_date",
                endExclusive
            )
            .order(
                "expense_date",
                {
                    ascending: true
                }
            );


    if (error) {

        throw new Error(
            "Errore lettura spese da Supabase: " +
            error.message
        );
    }


    return data || [];
}


// ======================================================
// DOWNLOAD SCONTRINO
// ======================================================

async function downloadReceiptBlob(
    storedValue
) {

    if (!storedValue) {
        return null;
    }


    // Vecchi record con URL completo
    if (
        /^https?:\/\//i.test(
            storedValue
        )
    ) {

        const response =
            await fetch(
                storedValue
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `Download scontrino fallito (${response.status}).`
            );
        }


        return await response.blob();
    }


    // Nuovi record:
    // percorso nel bucket privato

    const {
        data,
        error
    } =
        await supabaseClient
            .storage
            .from(
                RECEIPTS_BUCKET
            )
            .download(
                storedValue
            );


    if (error) {

        throw new Error(
            error.message
        );
    }


    return data;
}


// ======================================================
// MAPPATURA SPESE -> CELLE
// ======================================================

function aggregateExpensesByTargetCell(
    expenses,
    year,
    month
) {

    const map =
        new Map();


    for (
        const expense of expenses
    ) {

        const category =
            normalizeExpenseCategory(
                expense.category
            );


        const rowOffset =
            EXPENSE_CATEGORY_ROW_OFFSET[
                category
            ];


        if (
            !rowOffset
        ) {

            const key =
                `SKIP:${expense.id || Math.random()}`;


            map.set(
                key,
                {
                    cellRef: null,

                    amount:
                        Number(
                            expense.amount
                        ) || 0,

                    category:
                        category ||
                        String(
                            expense.category ||
                            ""
                        )
                }
            );


            continue;
        }


        const parts =
            String(
                expense.expense_date ||
                ""
            )
                .split("-")
                .map(Number);


        if (
            parts.length !==
            3
        ) {

            continue;
        }


        const [
            expenseYear,
            expenseMonth,
            day
        ] =
            parts;


        if (
            expenseYear !== year ||
            expenseMonth !== month
        ) {

            continue;
        }


        const date =
            new Date(
                expenseYear,
                expenseMonth - 1,
                day
            );


        const mondayWeekday =
            (
                date.getDay() +
                6
            ) % 7;


        const first =
            new Date(
                year,
                month - 1,
                1
            );


        const firstMondayWeekday =
            (
                first.getDay() +
                6
            ) % 7;


        const weekIndex =
            Math.floor(
                (
                    firstMondayWeekday +
                    day -
                    1
                ) /
                7
            );


        if (
            weekIndex < 0 ||
            weekIndex >=
                EXPENSE_DATE_ROWS.length
        ) {

            continue;
        }


        const row =
            EXPENSE_DATE_ROWS[
                weekIndex
            ] +
            rowOffset;


        const column =
            EXCEL_COLUMNS_BY_WEEKDAY[
                mondayWeekday
            ];


        const cellRef =
            `${column}${row}`;


        const amount =
            Number(
                expense.amount
            );


        if (
            !Number.isFinite(
                amount
            )
        ) {

            continue;
        }


        const existing =
            map.get(
                cellRef
            );


        if (
            existing
        ) {

            existing.amount +=
                amount;

        } else {

            map.set(
                cellRef,
                {
                    cellRef,
                    amount,
                    category
                }
            );
        }
    }


    return map;
}


// ======================================================
// NORMALIZZA CATEGORIA
// ======================================================

function normalizeExpenseCategory(
    category
) {

    const value =
        String(
            category || ""
        )
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                " "
            );


    const aliases = {

        "TAXI / TRAVEL":
            "TAXI / TRAVELS",

        "TRAVELS":
            "TAXI / TRAVELS",

        "TRAVEL":
            "TAXI / TRAVELS",

        "FUEL":
            "GASOLINE",

        "PETROL":
            "GASOLINE",

        "DIESEL":
            "GASOLINE"
    };


    return (
        aliases[value] ||
        value
    );
}


// ======================================================
// PULISCE CELLE SPESE
// ======================================================

function clearExpenseInputCells(
    doc
) {

    const ranges = [
        [6, 21],
        [31, 46],
        [56, 71],
        [81, 96],
        [106, 121],
        [132, 147]
    ];


    for (
        const [
            startRow,
            endRow
        ]
        of ranges
    ) {

        for (
            let row =
                startRow;
            row <=
                endRow;
            row++
        ) {

            for (
                const col of
                EXCEL_COLUMNS_BY_WEEKDAY
            ) {

                clearCellValue(
                    doc,
                    `${col}${row}`
                );
            }
        }
    }
}


// ======================================================
// XML HELPERS
// ======================================================

function elementsByLocalName(
    root,
    localName
) {

    if (!root) {
        return [];
    }


    if (
        typeof root.getElementsByTagNameNS ===
        "function"
    ) {

        return Array.from(
            root.getElementsByTagNameNS(
                "*",
                localName
            )
        );
    }


    return Array.from(
        root.getElementsByTagName(
            "*"
        )
    ).filter(
        node =>
            node.localName ===
                localName ||
            node.nodeName ===
                localName
    );
}


// ======================================================
// PARSER XML ROBUSTO
// ======================================================

function parseXml(
    text,
    label = "XML"
) {

    const cleanText =
        String(
            text ?? ""
        )
            .replace(
                /^\uFEFF/,
                ""
            )
            .replace(
                /^\s+(?=<\?xml)/,
                ""
            );


    const doc =
        new DOMParser()
            .parseFromString(
                cleanText,
                "application/xml"
            );


    const errors =
        elementsByLocalName(
            doc,
            "parsererror"
        );


    if (
        errors.length >
        0
    ) {

        console.error(
            `Errore XML in ${label}:`,
            errors[0].textContent
        );


        throw new Error(
            `Errore nella lettura interna del file Excel (${label}).`
        );
    }


    return doc;
}


function serializeXml(
    doc
) {

    return new XMLSerializer()
        .serializeToString(
            doc
        );
}


function spreadsheetNamespace(
    doc
) {

    return (
        doc.documentElement.namespaceURI ||
        "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    );
}


// ======================================================
// CELLE EXCEL
// ======================================================

function getRowNumberFromCellRef(
    ref
) {

    return Number(
        String(ref)
            .replace(
                /^[A-Z]+/i,
                ""
            )
    );
}


function getColumnLettersFromCellRef(
    ref
) {

    return String(ref)
        .replace(
            /\d+$/,
            ""
        )
        .toUpperCase();
}


function columnLettersToNumber(
    letters
) {

    let result = 0;


    for (
        const char of letters
    ) {

        result =
            result * 26 +
            (
                char.charCodeAt(0) -
                64
            );
    }


    return result;
}


function numberToColumnLetters(
    number
) {

    let n =
        number;


    let out =
        "";


    while (
        n > 0
    ) {

        const rem =
            (
                n - 1
            ) % 26;


        out =
            String.fromCharCode(
                65 + rem
            ) +
            out;


        n =
            Math.floor(
                (
                    n - 1
                ) /
                26
            );
    }


    return out;
}


// ======================================================
// CREA / RECUPERA RIGA
// ======================================================

function getOrCreateRow(
    doc,
    rowNumber
) {

    const rows =
        elementsByLocalName(
            doc,
            "row"
        );


    let row =
        rows.find(
            r =>
                Number(
                    r.getAttribute("r")
                ) ===
                rowNumber
        );


    if (
        row
    ) {

        return row;
    }


    const ns =
        spreadsheetNamespace(
            doc
        );


    row =
        doc.createElementNS(
            ns,
            "row"
        );


    row.setAttribute(
        "r",
        String(
            rowNumber
        )
    );


    const sheetData =
        elementsByLocalName(
            doc,
            "sheetData"
        )[0];


    if (
        !sheetData
    ) {

        throw new Error(
            "sheetData mancante nel template Excel."
        );
    }


    const next =
        rows.find(
            r =>
                Number(
                    r.getAttribute("r")
                ) >
                rowNumber
        );


    if (
        next
    ) {

        sheetData.insertBefore(
            row,
            next
        );

    } else {

        sheetData.appendChild(
            row
        );
    }


    return row;
}


// ======================================================
// CREA / RECUPERA CELLA
// ======================================================

function getOrCreateCell(
    doc,
    ref
) {

    const cells =
        elementsByLocalName(
            doc,
            "c"
        );


    let cell =
        cells.find(
            c =>
                c.getAttribute("r") ===
                ref
        );


    if (
        cell
    ) {

        return cell;
    }


    const rowNumber =
        getRowNumberFromCellRef(
            ref
        );


    const row =
        getOrCreateRow(
            doc,
            rowNumber
        );


    const ns =
        spreadsheetNamespace(
            doc
        );


    cell =
        doc.createElementNS(
            ns,
            "c"
        );


    cell.setAttribute(
        "r",
        ref
    );


    const targetCol =
        columnLettersToNumber(
            getColumnLettersFromCellRef(
                ref
            )
        );


    const rowCells =
        elementsByLocalName(
            row,
            "c"
        );


    const next =
        rowCells.find(
            c =>
                columnLettersToNumber(
                    getColumnLettersFromCellRef(
                        c.getAttribute("r")
                    )
                ) >
                targetCol
        );


    if (
        next
    ) {

        row.insertBefore(
            cell,
            next
        );

    } else {

        row.appendChild(
            cell
        );
    }


    return cell;
}


// ======================================================
// RIMUOVE CONTENUTO CELLA
// ======================================================

function removeCellContent(
    cell
) {

    for (
        const tag of [
            "v",
            "f",
            "is"
        ]
    ) {

        const nodes =
            elementsByLocalName(
                cell,
                tag
            );


        for (
            const node of nodes
        ) {

            if (
                node.parentNode ===
                cell
            ) {

                cell.removeChild(
                    node
                );
            }
        }
    }


    cell.removeAttribute(
        "t"
    );
}


function clearCellValue(
    doc,
    ref
) {

    const cell =
        getOrCreateCell(
            doc,
            ref
        );


    removeCellContent(
        cell
    );
}


// ======================================================
// SCRIVE NUMERO
// ======================================================

function setNumericCell(
    doc,
    ref,
    value,
    styleId = null
) {

    const cell =
        getOrCreateCell(
            doc,
            ref
        );


    removeCellContent(
        cell
    );


    if (
        styleId !== null &&
        Number.isInteger(
            Number(
                styleId
            )
        )
    ) {

        cell.setAttribute(
            "s",
            String(
                styleId
            )
        );
    }


    const ns =
        spreadsheetNamespace(
            doc
        );


    const v =
        doc.createElementNS(
            ns,
            "v"
        );


    v.textContent =
        String(
            Number(
                value
            )
        );


    cell.appendChild(
        v
    );
}


// ======================================================
// SCRIVE TESTO
// ======================================================

function setInlineStringCell(
    doc,
    ref,
    text,
    styleId = null
) {

    const cell =
        getOrCreateCell(
            doc,
            ref
        );


    removeCellContent(
        cell
    );


    cell.setAttribute(
        "t",
        "inlineStr"
    );


    if (
        styleId !== null &&
        Number.isInteger(
            Number(
                styleId
            )
        )
    ) {

        cell.setAttribute(
            "s",
            String(
                styleId
            )
        );
    }


    const ns =
        spreadsheetNamespace(
            doc
        );


    const is =
        doc.createElementNS(
            ns,
            "is"
        );


    const t =
        doc.createElementNS(
            ns,
            "t"
        );


    t.textContent =
        String(
            text
        );


    is.appendChild(
        t
    );


    cell.appendChild(
        is
    );
}


// ======================================================
// TROVA IL FILE XML DEL FOGLIO
// ======================================================

async function getWorksheetPath(
    zip,
    sheetName
) {

    const workbookDoc =
        parseXml(
            await zip
                .file(
                    "xl/workbook.xml"
                )
                .async(
                    "text"
                ),
            "xl/workbook.xml"
        );


    const relsDoc =
        parseXml(
            await zip
                .file(
                    "xl/_rels/workbook.xml.rels"
                )
                .async(
                    "text"
                ),
            "xl/_rels/workbook.xml.rels"
        );


    const sheet =
        elementsByLocalName(
            workbookDoc,
            "sheet"
        )
            .find(
                s =>
                    s.getAttribute(
                        "name"
                    ) ===
                    sheetName
            );


    if (!sheet) {
        return null;
    }


    const relationshipId =
        sheet.getAttribute(
            "r:id"
        ) ||
        Array.from(
            sheet.attributes
        )
            .find(
                a =>
                    a.localName ===
                    "id"
            )
            ?.value;


    if (
        !relationshipId
    ) {

        return null;
    }


    const relation =
        elementsByLocalName(
            relsDoc,
            "Relationship"
        )
            .find(
                r =>
                    r.getAttribute(
                        "Id"
                    ) ===
                    relationshipId
            );


    if (
        !relation
    ) {

        return null;
    }


    const target =
        relation.getAttribute(
            "Target"
        );


    if (
        !target
    ) {

        return null;
    }


    if (
        target.startsWith(
            "/"
        )
    ) {

        return target.replace(
            /^\//,
            ""
        );
    }


    return (
        "xl/" +
        target.replace(
            /^\.\//,
            ""
        )
    );
}


// ======================================================
// COLORI BLU / VERDE
// ======================================================

function ensureColoredStyle(
    stylesDoc,
    baseStyleId,
    targetRgb
) {

    const fontsNode =
        elementsByLocalName(
            stylesDoc,
            "fonts"
        )[0];


    const cellXfs =
        elementsByLocalName(
            stylesDoc,
            "cellXfs"
        )[0];


    if (
        !fontsNode ||
        !cellXfs
    ) {

        return baseStyleId;
    }


    const fonts =
        Array.from(
            fontsNode.children
        )
            .filter(
                node =>
                    node.localName ===
                    "font"
            );


    const xfs =
        Array.from(
            cellXfs.children
        )
            .filter(
                node =>
                    node.localName ===
                    "xf"
            );


    const targetFontId =
        fonts.findIndex(
            font => {

                const color =
                    Array.from(
                        font.children
                    )
                        .find(
                            node =>
                                node.localName ===
                                "color"
                        );


                return (
                    color &&
                    String(
                        color.getAttribute(
                            "rgb"
                        ) || ""
                    )
                        .toUpperCase() ===
                        targetRgb
                );
            }
        );


    if (
        targetFontId <
        0
    ) {

        return baseStyleId;
    }


    const base =
        xfs[
            baseStyleId
        ] ||
        xfs[0];


    if (
        !base
    ) {

        return baseStyleId;
    }


    const signature =
        styleSignature(
            base
        );


    for (
        let i = 0;
        i < xfs.length;
        i++
    ) {

        const xf =
            xfs[i];


        if (
            Number(
                xf.getAttribute(
                    "fontId"
                ) ||
                0
            ) !==
            targetFontId
        ) {

            continue;
        }


        if (
            styleSignature(
                xf
            ) ===
            signature
        ) {

            return i;
        }
    }


    const clone =
        base.cloneNode(
            true
        );


    clone.setAttribute(
        "fontId",
        String(
            targetFontId
        )
    );


    clone.setAttribute(
        "applyFont",
        "1"
    );


    cellXfs.appendChild(
        clone
    );


    cellXfs.setAttribute(
        "count",
        String(
            xfs.length +
            1
        )
    );


    return xfs.length;
}


function styleSignature(
    xf
) {

    const attrs =
        [];


    for (
        const attr of
        Array.from(
            xf.attributes
        )
    ) {

        if (
            attr.name ===
                "fontId" ||
            attr.name ===
                "applyFont"
        ) {

            continue;
        }


        attrs.push(
            `${attr.name}=${attr.value}`
        );
    }


    attrs.sort();


    const children =
        Array.from(
            xf.childNodes
        )
            .filter(
                node =>
                    node.nodeType ===
                    1
            )
            .map(
                node =>
                    new XMLSerializer()
                        .serializeToString(
                            node
                        )
            )
            .join("");


    return (
        attrs.join("|") +
        "||" +
        children
    );
}


// ======================================================
// FOGLIO PICTURES
// ======================================================

async function rebuildPicturesSheet(
    zip,
    picturesDoc,
    picturesPath,
    expenses
) {

    removeExistingPicturesDrawing(
        zip,
        picturesDoc,
        picturesPath
    );


    const sheetData =
        elementsByLocalName(
            picturesDoc,
            "sheetData"
        )[0];


    if (
        !sheetData
    ) {

        throw new Error(
            "Foglio Pictures non valido."
        );
    }


    while (
        sheetData.firstChild
    ) {

        sheetData.removeChild(
            sheetData.firstChild
        );
    }


    const receiptExpenses =
        expenses.filter(
            expense =>
                expense.receipt_url
        );


    const drawingItems =
        [];


    let inserted =
        0;


    let skipped =
        0;


    for (
        let i = 0;
        i <
        receiptExpenses.length;
        i++
    ) {

        const expense =
            receiptExpenses[i];


        try {

            setExcelStatus(
                `Inserimento scontrini: ${i + 1}/${receiptExpenses.length}...`
            );


            const sourceBlob =
                await downloadReceiptBlob(
                    expense.receipt_url
                );


            if (
                !sourceBlob
            ) {

                skipped++;

                continue;
            }


            const converted =
                await normalizeReceiptToJpeg(
                    sourceBlob
                );


            const mediaName =
                `omi_receipt_${i + 1}.jpg`;


            zip.file(
                `xl/media/${mediaName}`,
                converted.bytes
            );


            const position =
                receiptGridPosition(
                    i,
                    converted.width,
                    converted.height
                );


            const relationshipId =
                `rId${i + 1}`;


            drawingItems.push({
                relationshipId,
                mediaName,
                ...position
            });


            const labelColumn =
                numberToColumnLetters(
                    position.col +
                    1
                );


            const labelRow =
                position.row;


            const amount =
                Number(
                    expense.amount ||
                    0
                )
                    .toLocaleString(
                        "it-IT",
                        {
                            style:
                                "currency",
                            currency:
                                "EUR"
                        }
                    );


            const date =
                formatDateForExcelLabel(
                    expense.expense_date
                );


            const category =
                normalizeExpenseCategory(
                    expense.category
                );


            setInlineStringCell(
                picturesDoc,
                `${labelColumn}${labelRow}`,
                `${date} · ${category} · ${amount}`
            );


            inserted++;

        }

        catch (error) {

            console.warn(
                "Scontrino non inserito:",
                error
            );


            skipped++;
        }
    }


    if (
        drawingItems.length >
        0
    ) {

        await writePicturesDrawing(
            zip,
            picturesDoc,
            picturesPath,
            drawingItems
        );
    }


    updatePicturesDimension(
        picturesDoc,
        drawingItems.length
    );


    return {
        inserted,
        skipped
    };
}


// ======================================================
// RIMUOVE VECCHIE IMMAGINI
// ======================================================

function removeExistingPicturesDrawing(
    zip,
    picturesDoc,
    picturesPath
) {

    zip.remove(
        "xl/drawings/drawing1.xml"
    );


    zip.remove(
        "xl/drawings/_rels/drawing1.xml.rels"
    );


    const mediaFolder =
        zip.folder(
            "xl/media"
        );


    if (
        mediaFolder
    ) {

        for (
            const name of
            Object.keys(
                zip.files
            )
        ) {

            if (
                /^xl\/media\/omi_receipt_/i.test(
                    name
                )
            ) {

                zip.remove(
                    name
                );
            }
        }
    }


    const drawings =
        elementsByLocalName(
            picturesDoc,
            "drawing"
        );


    for (
        const drawing of
        drawings
    ) {

        drawing.parentNode.removeChild(
            drawing
        );
    }


    const relPath =
        worksheetRelationshipsPath(
            picturesPath
        );


    zip.remove(
        relPath
    );
}


// ======================================================
// POSIZIONE IMMAGINI
// ======================================================

function receiptGridPosition(
    index,
    imageWidth,
    imageHeight
) {

    const columns =
        [
            0,
            10,
            20,
            30
        ];


    const group =
        Math.floor(
            index /
            4
        );


    const slot =
        index %
        4;


    const col =
        columns[
            slot
        ];


    const row =
        2 +
        group *
        38;


    const maxWidth =
        300;


    const maxHeight =
        480;


    const scale =
        Math.min(
            maxWidth /
                imageWidth,
            maxHeight /
                imageHeight,
            1
        );


    const width =
        Math.max(
            80,
            Math.round(
                imageWidth *
                scale
            )
        );


    const height =
        Math.max(
            100,
            Math.round(
                imageHeight *
                scale
            )
        );


    return {
        col,
        row,
        width,
        height
    };
}


// ======================================================
// CREA DRAWING EXCEL
// ======================================================

async function writePicturesDrawing(
    zip,
    picturesDoc,
    picturesPath,
    items
) {

    const drawingXml =
        buildDrawingXml(
            items
        );


    const drawingRelsXml =
        buildDrawingRelationshipsXml(
            items
        );


    zip.file(
        "xl/drawings/drawing1.xml",
        drawingXml
    );


    zip.file(
        "xl/drawings/_rels/drawing1.xml.rels",
        drawingRelsXml
    );


    const relPath =
        worksheetRelationshipsPath(
            picturesPath
        );


    zip.file(
        relPath,
        buildWorksheetDrawingRelationshipXml()
    );


    const ns =
        spreadsheetNamespace(
            picturesDoc
        );


    const drawing =
        picturesDoc
            .createElementNS(
                ns,
                "drawing"
            );


    drawing.setAttributeNS(
        "http://www.w3.org/2000/xmlns/",
        "xmlns:r",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    );


    drawing.setAttributeNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "r:id",
        "rId1"
    );


    picturesDoc
        .documentElement
        .appendChild(
            drawing
        );


    await ensureImageContentTypes(
        zip
    );
}


// ======================================================
// XML DRAWING
// ======================================================

function buildDrawingXml(
    items
) {

    const anchors =
        items.map(
            (
                item,
                index
            ) => {

                const cx =
                    item.width *
                    9525;


                const cy =
                    item.height *
                    9525;


                const id =
                    index +
                    1;


                return `
<xdr:oneCellAnchor>
  <xdr:from>
    <xdr:col>${item.col}</xdr:col>
    <xdr:colOff>0</xdr:colOff>
    <xdr:row>${item.row}</xdr:row>
    <xdr:rowOff>0</xdr:rowOff>
  </xdr:from>
  <xdr:ext cx="${cx}" cy="${cy}"/>
  <xdr:pic>
    <xdr:nvPicPr>
      <xdr:cNvPr id="${id}" name="OMI Receipt ${id}"/>
      <xdr:cNvPicPr>
        <a:picLocks noChangeAspect="1"/>
      </xdr:cNvPicPr>
    </xdr:nvPicPr>

    <xdr:blipFill>
      <a:blip r:embed="${item.relationshipId}"/>
      <a:stretch>
        <a:fillRect/>
      </a:stretch>
    </xdr:blipFill>

    <xdr:spPr>
      <a:prstGeom prst="rect">
        <a:avLst/>
      </a:prstGeom>
    </xdr:spPr>
  </xdr:pic>

  <xdr:clientData/>
</xdr:oneCellAnchor>`;
            }
        )
            .join("");


    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr
 xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
}


// ======================================================
// RELAZIONI IMMAGINI
// ======================================================

function buildDrawingRelationshipsXml(
    items
) {

    const rels =
        items.map(
            item =>
                `<Relationship Id="${item.relationshipId}" ` +
                `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
                `Target="../media/${escapeXmlAttribute(
                    item.mediaName
                )}"/>`
        )
            .join("");


    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`;
}


// ======================================================
// RELAZIONE FOGLIO -> DRAWING
// ======================================================

function buildWorksheetDrawingRelationshipXml() {

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing"
    Target="../drawings/drawing1.xml"/>
</Relationships>`;
}


// ======================================================
// PATH RELAZIONI FOGLIO
// ======================================================

function worksheetRelationshipsPath(
    sheetPath
) {

    const lastSlash =
        sheetPath.lastIndexOf(
            "/"
        );


    const dir =
        sheetPath.slice(
            0,
            lastSlash
        );


    const file =
        sheetPath.slice(
            lastSlash +
            1
        );


    return (
        `${dir}/_rels/${file}.rels`
    );
}


// ======================================================
// CONTENT TYPES IMMAGINI
// ======================================================

async function ensureImageContentTypes(
    zip
) {

    const contentTypesPath =
        "[Content_Types].xml";


    const doc =
        parseXml(
            await zip
                .file(
                    contentTypesPath
                )
                .async(
                    "text"
                ),
            contentTypesPath
        );


    const types =
        doc.documentElement;


    const ns =
        types.namespaceURI;


    const defaults =
        elementsByLocalName(
            doc,
            "Default"
        );


    const hasJpg =
        defaults.some(
            node =>
                node.getAttribute(
                    "Extension"
                ) ===
                "jpg"
        );


    const hasJpeg =
        defaults.some(
            node =>
                node.getAttribute(
                    "Extension"
                ) ===
                "jpeg"
        );


    if (
        !hasJpg
    ) {

        const node =
            doc.createElementNS(
                ns,
                "Default"
            );


        node.setAttribute(
            "Extension",
            "jpg"
        );


        node.setAttribute(
            "ContentType",
            "image/jpeg"
        );


        types.insertBefore(
            node,
            types.firstChild
        );
    }


    if (
        !hasJpeg
    ) {

        const node =
            doc.createElementNS(
                ns,
                "Default"
            );


        node.setAttribute(
            "Extension",
            "jpeg"
        );


        node.setAttribute(
            "ContentType",
            "image/jpeg"
        );


        types.insertBefore(
            node,
            types.firstChild
        );
    }


    zip.file(
        contentTypesPath,
        serializeXml(
            doc
        )
    );
}


// ======================================================
// DIMENSIONE FOGLIO PICTURES
// ======================================================

function updatePicturesDimension(
    doc,
    imageCount
) {

    const dimension =
        elementsByLocalName(
            doc,
            "dimension"
        )[0];


    if (
        !dimension
    ) {

        return;
    }


    const groups =
        Math.max(
            1,
            Math.ceil(
                imageCount /
                4
            )
        );


    const lastRow =
        2 +
        groups *
        38;


    dimension.setAttribute(
        "ref",
        `A1:AN${lastRow}`
    );
}


// ======================================================
// DATA PER ETICHETTA
// ======================================================

function formatDateForExcelLabel(
    isoDate
) {

    const parts =
        String(
            isoDate || ""
        )
            .split("-");


    if (
        parts.length !==
        3
    ) {

        return String(
            isoDate ||
            ""
        );
    }


    return (
        `${parts[2]}/` +
        `${parts[1]}/` +
        `${parts[0]}`
    );
}


// ======================================================
// ESCAPE XML
// ======================================================

function escapeXmlAttribute(
    value
) {

    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        );
}


// ======================================================
// CONVERSIONE SCONTRINI IN JPEG
// ======================================================

async function normalizeReceiptToJpeg(
    blob
) {

    const image =
        await blobToImage(
            blob
        );


    const maxSide =
        1600;


    const ratio =
        Math.min(
            1,
            maxSide /
            Math.max(
                image.width,
                image.height
            )
        );


    const width =
        Math.max(
            1,
            Math.round(
                image.width *
                ratio
            )
        );


    const height =
        Math.max(
            1,
            Math.round(
                image.height *
                ratio
            )
        );


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        width;


    canvas.height =
        height;


    const context =
        canvas.getContext(
            "2d"
        );


    context.fillStyle =
        "#ffffff";


    context.fillRect(
        0,
        0,
        width,
        height
    );


    context.drawImage(
        image.element,
        0,
        0,
        width,
        height
    );


    const jpegBlob =
        await new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(
                    result =>
                        result
                            ? resolve(
                                result
                            )
                            : reject(
                                new Error(
                                    "Conversione immagine fallita."
                                )
                            ),
                    "image/jpeg",
                    0.86
                );
            }
        );


    return {
        bytes:
            await jpegBlob.arrayBuffer(),

        width,
        height
    };
}


// ======================================================
// BLOB -> IMAGE
// ======================================================

async function blobToImage(
    blob
) {

    const url =
        URL.createObjectURL(
            blob
        );


    try {

        const img =
            new Image();


        img.decoding =
            "async";


        await new Promise(
            (
                resolve,
                reject
            ) => {

                img.onload =
                    resolve;


                img.onerror =
                    () =>
                        reject(
                            new Error(
                                "Formato immagine non leggibile dal browser."
                            )
                        );


                img.src =
                    url;
            }
        );


        return {
            element:
                img,

            width:
                img.naturalWidth,

            height:
                img.naturalHeight
        };

    }

    finally {

        URL.revokeObjectURL(
            url
        );
    }
}


// ======================================================
// RICALCOLO FORMULE EXCEL
// ======================================================

async function forceFullCalculation(
    zip
) {

    const workbookPath =
        "xl/workbook.xml";


    const workbookDoc =
        parseXml(
            await zip
                .file(
                    workbookPath
                )
                .async(
                    "text"
                ),
            workbookPath
        );


    const ns =
        workbookDoc
            .documentElement
            .namespaceURI;


    let calcPr =
        elementsByLocalName(
            workbookDoc,
            "calcPr"
        )[0];


    if (
        !calcPr
    ) {

        calcPr =
            workbookDoc
                .createElementNS(
                    ns,
                    "calcPr"
                );


        workbookDoc
            .documentElement
            .appendChild(
                calcPr
            );
    }


    calcPr.setAttribute(
        "calcMode",
        "auto"
    );


    calcPr.setAttribute(
        "fullCalcOnLoad",
        "1"
    );


    calcPr.setAttribute(
        "forceFullCalc",
        "1"
    );


    calcPr.setAttribute(
        "calcId",
        "0"
    );


    zip.file(
        workbookPath,
        serializeXml(
            workbookDoc
        )
    );


    // La vecchia calcChain non serve più

    zip.remove(
        "xl/calcChain.xml"
    );


    const relsPath =
        "xl/_rels/workbook.xml.rels";


    const relsDoc =
        parseXml(
            await zip
                .file(
                    relsPath
                )
                .async(
                    "text"
                ),
            relsPath
        );


    for (
        const rel of
        elementsByLocalName(
            relsDoc,
            "Relationship"
        )
    ) {

        if (
            String(
                rel.getAttribute(
                    "Type"
                ) || ""
            )
                .endsWith(
                    "/calcChain"
                )
        ) {

            rel.parentNode.removeChild(
                rel
            );
        }
    }


    zip.file(
        relsPath,
        serializeXml(
            relsDoc
        )
    );


    const contentTypesPath =
        "[Content_Types].xml";


    const ctDoc =
        parseXml(
            await zip
                .file(
                    contentTypesPath
                )
                .async(
                    "text"
                ),
            contentTypesPath
        );


    for (
        const override of
        elementsByLocalName(
            ctDoc,
            "Override"
        )
    ) {

        if (
            override.getAttribute(
                "PartName"
            ) ===
            "/xl/calcChain.xml"
        ) {

            override.parentNode.removeChild(
                override
            );
        }
    }


    zip.file(
        contentTypesPath,
        serializeXml(
            ctDoc
        )
    );
}


// ======================================================
// DOWNLOAD FILE
// ======================================================

function downloadBlob(
    blob,
    fileName
) {

    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        fileName;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        2000
    );
}