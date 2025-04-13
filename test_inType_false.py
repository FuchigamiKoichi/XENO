import module as m

def choice(now,choices,kind):
    out = {'now':now,'kind':kind,'choices':choices}
    choice = choices[0]
    return input(str(choice))

def test_inType_false_1():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(0)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_2():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(1)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_3():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(2)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_4():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(3)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_5():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(4)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_6():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(5)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_7():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(6)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_8():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(7)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_9():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(8)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'

def test_inType_false_10():
        p = m.Player('test_player')
        f = m.Field(players=[p])
        C1 = m.Card1(player=p,field=f)
        C2 = m.Card2(player=p,field=f)
        C3 = m.Card3(player=p,field=f)
        C4 = m.Card4(player=p,field=f)
        C5 = m.Card5(player=p,field=f)
        C6 = m.Card6(player=p,field=f)
        C7 = m.Card7(player=p,field=f)
        C8 = m.Card8(player=p,field=f)
        C9 = m.Card9(player=p,field=f)
        C10 = m.Card10(player=p,field=f)

        C_list = [C1,C2,C3,C4,C5,C6,C7,C8,C9,C10]
        drop_card = C_list.pop(9)
        if m.inType(type=type(drop_card),list=C_list):
            result = 'contain'
        else:
            result = 'omite'
        assert result == 'omite'