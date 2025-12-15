// Game will initialize when DOM and Matter.js are loaded
(function () {
    'use strict';

    // Wait for DOM to be ready
    window.addEventListener('DOMContentLoaded', function () {
        // Check if Matter.js is loaded
        if (typeof Matter === 'undefined') {
            console.error('Matter.js is not available');
            alert('게임을 로드할 수 없습니다. Matter.js 라이브러리가 로드되지 않았습니다.');
            return;
        }

        // Matter.js module aliases
        const { Engine, Render, Runner, Bodies, World, Events, Body, Composite } = Matter;

        // Fruit configurations
        const FRUITS = [
            { name: 'cherry', radius: 20, color: '#ff0844', emoji: '🍒', score: 1 },
            { name: 'strawberry', radius: 28, color: '#ff4757', emoji: '🍓', score: 3 },
            { name: 'grape', radius: 35, color: '#a29bfe', emoji: '🍇', score: 6 },
            { name: 'orange', radius: 42, color: '#ffa502', emoji: '🍊', score: 10 },
            { name: 'lemon', radius: 48, color: '#ffd32a', emoji: '🍋', score: 15 },
            { name: 'apple', radius: 55, color: '#ff6348', emoji: '🍎', score: 21 },
            { name: 'pear', radius: 62, color: '#26de81', emoji: '🍐', score: 28 },
            { name: 'peach', radius: 68, color: '#ffbe76', emoji: '🍑', score: 36 },
            { name: 'pineapple', radius: 75, color: '#f6b93b', emoji: '🍍', score: 45 },
            { name: 'melon', radius: 120, color: '#55efc4', emoji: '🍈', score: 55 },
            { name: 'watermelon', radius: 150, color: '#ff7675', emoji: '🍉', score: 66 }
        ];

        // Game configuration
        const CONFIG = {
            width: 560,
            height: 700,
            wallThickness: 20,
            topMargin: 60,
            dangerLine: 60
        };

        // Game state
        let engine, render, runner, world;
        let currentFruit = null;
        let nextFruit = null;
        let mouseX = CONFIG.width / 2;
        let score = 0;
        let bestScore = 0;
        let isGameOver = false;
        let isGameStarted = false;
        let canDrop = true;

        // DOM elements
        const canvas = document.getElementById('gameCanvas');
        const nextCanvas = document.getElementById('nextFruitCanvas');
        const scoreElement = document.getElementById('score');
        const bestScoreElement = document.getElementById('bestScore');
        const finalScoreElement = document.getElementById('finalScore');
        const startBtn = document.getElementById('startBtn');
        const restartBtn = document.getElementById('restartBtn');
        const playAgainBtn = document.getElementById('playAgainBtn');
        const gameOverOverlay = document.getElementById('gameOverOverlay');
        const cursorGuide = document.getElementById('cursorGuide');
        const gameContainer = document.querySelector('.game-container');

        // Initialize the game
        function init() {
            console.log('Initializing game...');

            // Load best score
            bestScore = parseInt(localStorage.getItem('fruitBoxBestScore') || '0');
            bestScoreElement.textContent = bestScore;

            // Create engine
            engine = Engine.create({
                gravity: { x: 0, y: 1 }
            });
            world = engine.world;

            // Create renderer
            render = Render.create({
                canvas: canvas,
                engine: engine,
                options: {
                    width: CONFIG.width,
                    height: CONFIG.height,
                    wireframes: false,
                    background: 'transparent'
                }
            });

            // Create boundaries
            const wallOptions = {
                isStatic: true,
                render: {
                    fillStyle: 'rgba(102, 126, 234, 0.3)',
                    strokeStyle: 'rgba(102, 126, 234, 0.5)',
                    lineWidth: 2
                }
            };

            const ground = Bodies.rectangle(
                CONFIG.width / 2,
                CONFIG.height + CONFIG.wallThickness / 2,
                CONFIG.width,
                CONFIG.wallThickness,
                wallOptions
            );

            const leftWall = Bodies.rectangle(
                -CONFIG.wallThickness / 2,
                CONFIG.height / 2,
                CONFIG.wallThickness,
                CONFIG.height,
                wallOptions
            );

            const rightWall = Bodies.rectangle(
                CONFIG.width + CONFIG.wallThickness / 2,
                CONFIG.height / 2,
                CONFIG.wallThickness,
                CONFIG.height,
                wallOptions
            );

            World.add(world, [ground, leftWall, rightWall]);

            // Start render
            Render.run(render);

            // Create runner
            runner = Runner.create();
            Runner.run(runner, engine);

            // Setup event listeners
            setupEventListeners();

            // Custom renderer to draw emojis
            Events.on(render, 'afterRender', function () {
                const context = render.context;
                const bodies = Composite.allBodies(world);

                context.font = 'bold 30px Arial';
                context.textAlign = 'center';
                context.textBaseline = 'middle';

                bodies.forEach(function (body) {
                    if (body.fruitIndex !== undefined) {
                        const fruitConfig = FRUITS[body.fruitIndex];
                        const scaleFactor = (fruitConfig.radius / 30);
                        context.font = 'bold ' + (30 * scaleFactor) + 'px Arial';
                        context.fillText(
                            fruitConfig.emoji,
                            body.position.x,
                            body.position.y
                        );
                    }
                });
            });

            // Initialize next fruit
            nextFruit = getRandomFruit();
            drawNextFruit();

            console.log('Game initialized successfully');
        }

        function setupEventListeners() {
            // Mouse move
            gameContainer.addEventListener('mousemove', function (e) {
                if (!isGameStarted || isGameOver) return;

                const rect = gameContainer.getBoundingClientRect();
                const scaleX = CONFIG.width / rect.width;
                mouseX = (e.clientX - rect.left) * scaleX;

                // Constrain to boundaries
                const fruitRadius = currentFruit ? FRUITS[currentFruit.fruitIndex].radius : 25;
                mouseX = Math.max(fruitRadius + 10, Math.min(CONFIG.width - fruitRadius - 10, mouseX));

                // Update cursor guide
                cursorGuide.style.left = (mouseX / CONFIG.width) * 100 + '%';

                if (currentFruit && !currentFruit.isDropped) {
                    Body.setPosition(currentFruit, { x: mouseX, y: currentFruit.position.y });
                }
            });

            // Click to drop
            gameContainer.addEventListener('click', function () {
                if (!isGameStarted || isGameOver || !canDrop || !currentFruit) return;
                dropFruit();
            });

            // Button listeners
            startBtn.addEventListener('click', startGame);
            restartBtn.addEventListener('click', resetGame);
            playAgainBtn.addEventListener('click', function () {
                gameOverOverlay.style.display = 'none';
                resetGame();
            });

            // Collision events
            Events.on(engine, 'collisionStart', function (event) {
                event.pairs.forEach(function (pair) {
                    const { bodyA, bodyB } = pair;

                    if (bodyA.fruitIndex !== undefined &&
                        bodyB.fruitIndex !== undefined &&
                        bodyA.fruitIndex === bodyB.fruitIndex &&
                        bodyA.fruitIndex < FRUITS.length - 1) {

                        // Merge fruits
                        mergeFruits(bodyA, bodyB);
                    }
                });
            });

            // Check for game over
            Events.on(engine, 'afterUpdate', function () {
                if (!isGameStarted || isGameOver) return;

                const bodies = Composite.allBodies(world);
                for (let i = 0; i < bodies.length; i++) {
                    const body = bodies[i];
                    if (body.fruitIndex !== undefined && body.position.y < CONFIG.dangerLine) {
                        // Check if it's been there for a while (not just passing through)
                        if (!body.dangerTimer) {
                            body.dangerTimer = Date.now();
                        } else if (Date.now() - body.dangerTimer > 2000) {
                            triggerGameOver();
                            break;
                        }
                    } else if (body.fruitIndex !== undefined) {
                        body.dangerTimer = null;
                    }
                }
            });
        }

        function getRandomFruit() {
            // Only spawn first 5 fruit types
            return Math.floor(Math.random() * 5);
        }

        function createFruit(x, y, fruitIndex, isStatic) {
            const fruitConfig = FRUITS[fruitIndex];

            const fruit = Bodies.circle(x, y, fruitConfig.radius, {
                restitution: 0.3,
                friction: 0.5,
                isStatic: isStatic || false,
                render: {
                    fillStyle: fruitConfig.color,
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 2
                }
            });

            fruit.fruitIndex = fruitIndex;
            fruit.emoji = fruitConfig.emoji;
            fruit.isDropped = false;

            // Add emoji label
            fruit.label = fruitConfig.emoji;

            World.add(world, fruit);
            return fruit;
        }

        function drawNextFruit() {
            const ctx = nextCanvas.getContext('2d');
            ctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

            const fruitConfig = FRUITS[nextFruit];
            ctx.font = '50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fruitConfig.emoji, nextCanvas.width / 2, nextCanvas.height / 2);
        }

        function spawnNewFruit() {
            if (isGameOver) return;

            // Spawn fruit below the danger line (y=100 instead of y=30)
            currentFruit = createFruit(mouseX, 100, nextFruit, true);
            nextFruit = getRandomFruit();
            drawNextFruit();
            canDrop = true;
        }

        function dropFruit() {
            if (!currentFruit || currentFruit.isDropped) return;

            currentFruit.isDropped = true;
            Body.setStatic(currentFruit, false);
            canDrop = false;

            setTimeout(function () {
                spawnNewFruit();
            }, 500);
        }

        function mergeFruits(bodyA, bodyB) {
            const newIndex = bodyA.fruitIndex + 1;
            if (newIndex >= FRUITS.length) return;

            // Calculate merge position
            const x = (bodyA.position.x + bodyB.position.x) / 2;
            const y = (bodyA.position.y + bodyB.position.y) / 2;

            // Remove old fruits
            World.remove(world, bodyA);
            World.remove(world, bodyB);

            // Create new fruit
            const newFruit = createFruit(x, y, newIndex, false);

            // Add some upward velocity for visual effect
            Body.setVelocity(newFruit, { x: 0, y: -2 });

            // Update score
            updateScore(FRUITS[newIndex].score);

            // Visual feedback
            console.log('Merge effect at ' + x + ', ' + y);
        }

        function updateScore(points) {
            score += points;
            scoreElement.textContent = score;

            if (score > bestScore) {
                bestScore = score;
                bestScoreElement.textContent = bestScore;
                localStorage.setItem('fruitBoxBestScore', bestScore.toString());
            }

            // Animate score
            scoreElement.style.transform = 'scale(1.2)';
            setTimeout(function () {
                scoreElement.style.transform = 'scale(1)';
            }, 200);
        }

        function startGame() {
            console.log('Starting game...');
            isGameStarted = true;
            isGameOver = false;
            startBtn.style.display = 'none';
            restartBtn.style.display = 'flex';
            cursorGuide.classList.add('active');

            spawnNewFruit();
        }

        function resetGame() {
            // Clear all fruits
            const bodies = Composite.allBodies(world);
            bodies.forEach(function (body) {
                if (body.fruitIndex !== undefined) {
                    World.remove(world, body);
                }
            });

            // Reset state
            currentFruit = null;
            score = 0;
            isGameOver = false;
            isGameStarted = true;
            canDrop = true;
            scoreElement.textContent = '0';

            // Spawn new fruit
            nextFruit = getRandomFruit();
            drawNextFruit();
            spawnNewFruit();
        }

        function triggerGameOver() {
            if (isGameOver) return;

            isGameOver = true;
            canDrop = false;
            cursorGuide.classList.remove('active');

            finalScoreElement.textContent = score;
            gameOverOverlay.style.display = 'flex';
        }

        // Initialize the game
        init();
    });
})();
