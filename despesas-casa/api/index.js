// api/index.js

require('dotenv').config(); // Para usar variáveis de ambiente

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
const path = require('path'); // Adicionado para manipular caminhos de diretório

const app = express();

// Conexão com o MongoDB usando variável de ambiente para a URI
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch((err) => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1); // Encerrar o processo em caso de erro na conexão
  });

// Esquema do Mongoose
const expenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
});

const Expense = mongoose.model('Expense', expenseSchema);

// Configurações do Express
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layout');

// Ajustar o caminho para as views
app.set('views', path.join(__dirname, '../views'));

// Ajustar o caminho para os arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Função auxiliar para agrupar despesas por mês e ano
const groupExpensesByMonth = (expenses) => {
  const monthlyExpenses = {};

  expenses.forEach(expense => {
    const month = expense.date.getMonth() + 1; // Mês de 1 a 12
    const year = expense.date.getFullYear();
    const key = `${month}/${year}`;

    if (!monthlyExpenses[key]) {
      monthlyExpenses[key] = 0;
    }
    monthlyExpenses[key] += expense.amount;
  });

  return monthlyExpenses;
};

// Rotas

// Rota para a página inicial
app.get('/', async (req, res) => {
  try {
    // Busca todas as despesas
    const expenses = await Expense.find({});

    // Agrupa despesas por mês
    const monthlyExpenses = groupExpensesByMonth(expenses);

    // Envia os dados para a view 'index.ejs'
    res.render('index', { title: 'Despesas da Casa', monthlyExpenses });
  } catch (err) {
    console.error('Erro ao buscar despesas:', err);
    res.status(500).send('Erro ao buscar as despesas.');
  }
});

// Rota para adicionar despesa (GET)
app.get('/add', (req, res) => {
  res.render('addExpense', { title: 'Adicionar Despesa' });
});

// Rota para adicionar despesa (POST)
app.post('/add', async (req, res) => {
  const { name, amount, date, category } = req.body;
  const { redirect, month, year } = req.query;

  if (!name || !amount || !date || !category) {
    return res.status(400).send('Todos os campos são obrigatórios.');
  }

  const newExpense = new Expense({
    name,
    amount: parseFloat(amount),
    date: new Date(date),
    category,
  });

  try {
    await newExpense.save();
    if (redirect === 'summary') {
      res.redirect(`/summary?month=${month}&year=${year}`);
    } else {
      res.redirect('/summary');
    }
  } catch (err) {
    console.error('Erro ao salvar a despesa:', err);
    res.status(500).send('Erro ao salvar a despesa.');
  }
});

// Rota para o resumo das despesas
app.get('/summary', async (req, res) => {
  let { month, year } = req.query;

  const now = new Date();
  month = month ? parseInt(month) - 1 : now.getMonth(); // Ajuste do mês (0 a 11)
  year = year ? parseInt(year) : now.getFullYear();

  try {
    const expenses = await Expense.find({
      date: {
        $gte: new Date(year, month, 1),
        $lt: new Date(year, month + 1, 1),
      },
    });

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    res.render('summary', {
      expenses,
      total,
      month: month + 1,
      year,
      title: 'Resumo de Pagamentos',
    });
  } catch (err) {
    console.error('Erro ao obter o resumo das despesas:', err);
    res.status(500).send('Erro ao obter o resumo das despesas.');
  }
});

// Rota para exibir o formulário de edição de despesa (GET)
app.get('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;

  try {
    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).send('Despesa não encontrada.');
    }
    res.render('editExpense', {
      title: 'Editar Despesa',
      expense,
      month,
      year
    });
  } catch (err) {
    console.error('Erro ao buscar a despesa para edição:', err);
    res.status(500).send('Erro ao buscar a despesa.');
  }
});

// Rota para atualizar a despesa (POST)
app.post('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { name, amount, date, category } = req.body;
  const { month, year } = req.query;

  try {
    await Expense.findByIdAndUpdate(id, {
      name,
      amount: parseFloat(amount),
      date: new Date(date),
      category
    });
    res.redirect(`/summary?month=${month}&year=${year}`);
  } catch (err) {
    console.error('Erro ao atualizar a despesa:', err);
    res.status(500).send('Erro ao atualizar a despesa.');
  }
});

// Rota para excluir uma despesa (POST)
app.post('/delete/:id', async (req, res) => {
  console.log(`Recebida solicitação de exclusão para o ID: ${req.params.id}`);
  const { id } = req.params;
  const { month, year } = req.query;

  try {
    await Expense.findByIdAndDelete(id);
    res.redirect(`/summary?month=${month}&year=${year}`);
  } catch (err) {
    console.error('Erro ao excluir a despesa:', err);
    res.status(500).send('Erro ao excluir a despesa.');
  }
});

// Middleware para servir arquivos estáticos (mantenha depois das rotas)
// Ajustado para o novo caminho
app.use(express.static(path.join(__dirname, '../public')));

// Exportar o aplicativo
module.exports = app;
