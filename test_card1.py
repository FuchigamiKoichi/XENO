import module as m

def choice(now,choices,kind):
    return choices[0]

def test_opponent_choice():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    opponent = p.hands[0].opponentChoice(choice=choice)
    assert opponent != None

def test_number_player():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card1 = m.Card1(player=p,field=f)
    card2 = m.Card1(player=p,field=f)
    p.hands.append(card1)
    p.hands.append(card2)
    p.hands[0].play(choice=choice)
    assert len(p.hands) == 1

def test_number_object():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card1 = m.Card1(player=p,field=f)
    card2 = m.Card1(player=p,field=f)
    f.draw(player=o,choice=choice)
    p.hands.append(card1)
    p.hands.append(card2)
    p.hands[0].play(choice=choice)
    assert len(o.hands) == 1


def test_played_none():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    assert len(f.played) == 0

def test_p_hands():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    assert type(p.hands[0]) == m.Card1

def test_move():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    assert type(p.hands[0].move()) == m.Card1

def test_played():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card = m.Card1(player=p,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)
    if m.inType(type=m.Card1,list=f.played):
        result = 'contain'
    else:
        result = 'omit'
    assert result == 'contain'

def test_holder():
    p = m.Player(name='test_player')
    o = m.Player(name='test_object')
    f = m.Field(players=[p,o])
    card1_1 = m.Card1(player=p,field=f)
    card1_2 = m.Card2(player=o,field=f)
    p.hands.append(card)
    p.hands[0].play(choice=choice)