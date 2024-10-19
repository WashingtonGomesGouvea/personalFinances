require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const expressLayouts = require('express-ejs-layouts')
const path = require('path')

const app = express()

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch((err) => {
    console.error('Erro ao conectar ao MongoDB:', err)
    process.exit(1)
  })

const expenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
})

const Expense = mongoose.model('Expense', expenseSchema)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(expressLayouts)
app.set('view engine', 'ejs')
app.set('layout', 'layout')

app.set('views', path.join(__dirname, '../views'))

app.use(express.static(path.join(__dirname, '../public')))

const groupExpensesByMonth = async () => {
  const result = await Expense.aggregate([
    {
      $group: {
        _id: { 
          month: { $month: "$date" }, 
          year: { $year: "$date" } 
        },
        totalAmount: { $sum: "$amount" }
      }
    },
    { 
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);

  const monthlyExpenses = {};
  result.forEach(item => {
    const key = `${item._id.month}/${item._id.year}`;
    monthlyExpenses[key] = item.totalAmount;
  });

  return monthlyExpenses;
};

app.get('/', async (req, res) => {
  const { page = 1, limit = 10 } = req.query

  try {
    const expenses = await Expense.find({})
      .skip((page - 1) * limit)
      .limit(parseInt(limit))

    const monthlyExpenses = await groupExpensesByMonth(expenses)

    const totalExpenses = await Expense.countDocuments()

    const totalPages = Math.ceil(totalExpenses / limit)

    res.render('index', {
      title: 'Despesas da Casa',
      monthlyExpenses,
      currentPage: parseInt(page),
      totalPages,
    })
  } catch (err) {
    console.error('Erro ao buscar despesas:', err)
    res.status(500).send('Erro ao buscar as despesas.')
  }
})

app.get('/add', (req, res) => {
  res.render('addExpense', { title: 'Adicionar Despesa' })
})

app.post('/add', async (req, res) => {
  const { name, amount, date, category } = req.body
  const { redirect, month, year } = req.query

  if (!name || !amount || !date || !category) {
    return res.status(400).send('Todos os campos são obrigatórios.')
  }

  const newExpense = new Expense({
    name,
    amount: parseFloat(amount),
    date: new Date(date),
    category,
  })

  try {
    await newExpense.save()
    if (redirect === 'summary') {
      res.redirect(`/summary?month=${month}&year=${year}`)
    } else {
      res.redirect('/summary')
    }
  } catch (err) {
    console.error('Erro ao salvar a despesa:', err)
    res.status(500).send('Erro ao salvar a despesa.')
  }
})

app.get('/summary', async (req, res) => {
  let { month, year } = req.query

  const now = new Date()
  month = month ? parseInt(month) - 1 : now.getMonth()
  year = year ? parseInt(year) : now.getFullYear()

  try {
    const expenses = await Expense.find({
      date: {
        $gte: new Date(year, month, 1),
        $lt: new Date(year, month + 1, 1),
      },
    })

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    res.render('summary', {
      expenses,
      total,
      month: month + 1,
      year,
      title: 'Resumo de Pagamentos',
    })
  } catch (err) {
    console.error('Erro ao obter o resumo das despesas:', err)
    res.status(500).send('Erro ao obter o resumo das despesas.')
  }
})

app.get('/edit/:id', async (req, res) => {
  const { id } = req.params
  const { month, year } = req.query

  try {
    const expense = await Expense.findById(id)
    if (!expense) {
      return res.status(404).send('Despesa não encontrada.')
    }
    res.render('editExpense', {
      title: 'Editar Despesa',
      expense,
      month,
      year
    })
  } catch (err) {
    console.error('Erro ao buscar a despesa para edição:', err)
    res.status(500).send('Erro ao buscar a despesa.')
  }
})

app.post('/edit/:id', async (req, res) => {
  const { id } = req.params
  const { name, amount, date, category } = req.body
  const { month, year } = req.query

  try {
    await Expense.findByIdAndUpdate(id, {
      name,
      amount: parseFloat(amount),
      date: new Date(date),
      category
    })
    res.redirect(`/summary?month=${month}&year=${year}`)
  } catch (err) {
    console.error('Erro ao atualizar a despesa:', err)
    res.status(500).send('Erro ao atualizar a despesa.')
  }
})

app.post('/delete/:id', async (req, res) => {
  const { id } = req.params
  const { month, year } = req.query

  try {
    await Expense.findByIdAndDelete(id)
    res.redirect(`/summary?month=${month}&year=${year}`)
  } catch (err) {
    console.error('Erro ao excluir a despesa:', err)
    res.status(500).send('Erro ao excluir a despesa.')
  }
})

app.use(express.static(path.join(__dirname, '../public')))

module.exports = app
