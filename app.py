from flask import Flask, render_template, request, redirect, url_for
from decimal import Decimal
from datetime import datetime

app = Flask(__name__)

TRANSACTIONS = []
ASSETS = []


def compute_metrics(transactions):
    total = Decimal('0')
    income = Decimal('0')
    expenses = Decimal('0')
    for t in transactions:
        amt = Decimal(str(t.get('amount', 0)))
        if t.get('type') == 'income':
            income += amt
            total += amt
        else:
            expenses += amt
            total -= amt
    savings_rate = None
    try:
        savings_rate = (income - expenses) / income * 100 if income > 0 else None
    except Exception:
        savings_rate = None
    return {
        'total_balance': f"R{total:,.2f}",
        'monthly_income': f"R{income:,.2f}",
        'monthly_expenses': f"R{expenses:,.2f}",
        'savings_rate': f"{savings_rate:.0f}%" if savings_rate is not None else '—'
    }


@app.route('/')
def index():
    metrics = compute_metrics(TRANSACTIONS)
    recent = list(reversed([f"{t['date']} — {t['description']} — R{t['amount']}" for t in TRANSACTIONS]))[:5]
    return render_template('index.html', recent_transactions=recent, **metrics)


@app.route('/track', methods=['GET', 'POST'])
def track_spend():
    if request.method == 'POST':
        date = request.form.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
        description = request.form.get('description', '').strip() or 'No description'
        try:
            amount = Decimal(request.form.get('amount', '0'))
        except Exception:
            amount = Decimal('0')
        category = request.form.get('category', 'Other')
        tx_type = request.form.get('type', 'expense')

        TRANSACTIONS.append({
            'date': date,
            'description': description,
            'amount': f"{amount:.2f}",
            'category': category,
            'type': tx_type,
        })
        return redirect(url_for('track_spend'))

    
    recent = list(reversed(TRANSACTIONS))[:10]
    return render_template('track_spend.html', transactions=recent)



@app.route('/networth', methods=['GET', 'POST'])
def networth():
    if request.method == 'POST':
        name = request.form.get('name', 'Unnamed')
        try:
            price = Decimal(request.form.get('price', '0'))
        except Exception:
            price = Decimal('0')
        account = request.form.get('account', 'Unknown')

        ASSETS.append({'name': name, 'price': float(price), 'account': account})
        return redirect(url_for('networth'))

    labels = [a['name'] for a in ASSETS]
    values = [a['price'] for a in ASSETS]
    total = sum(values) if values else 0
    return render_template('networth.html', assets=ASSETS, labels=labels, values=values, total=total)


@app.route('/about')
def about():
    return render_template('about.html')


if __name__ == '__main__':
    app.run(debug=True)
